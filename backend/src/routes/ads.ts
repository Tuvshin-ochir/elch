/**
 * Click-to-Message ads: reach NEW people (who never messaged the page) by age / gender / location.
 * People who click the ad open a Messenger / Instagram chat, which the bot then answers.
 */
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { config } from "../config.ts";
import { decrypt } from "../lib/crypto.ts";
import { badRequest, notFound, param, parse } from "../lib/http.ts";
import { prisma, type AdCampaign } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import * as ads from "../services/meta/ads.ts";

export const adsRouter = Router();
adsRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

const TargetingSchema = z.object({
  ageMin: z.number().int().min(18).max(65).default(18),
  ageMax: z.number().int().min(18).max(65).default(65),
  gender: z.enum(["MALE", "FEMALE"]).nullable().default(null),
  cities: z.array(z.string()).max(25).default([]),
  districts: z.array(z.string()).max(9).default([]),
  radiusKm: z.number().min(1).max(80).default(3),
});

async function userToken(businessId: string) {
  const acc = await prisma.metaAccount.findUnique({ where: { businessId } });
  if (!acc) throw badRequest("Facebook холбогдоогүй байна", "META_NOT_CONNECTED");
  return decrypt(acc.accessToken);
}

/** Chats and leads that came from each ad (attributed via the webhook referral). */
async function ourResults(businessId: string, adIds: string[]) {
  if (!adIds.length) return new Map<string, { chats: number; leads: number }>();
  const [chats, leads] = await Promise.all([
    prisma.contact.groupBy({ by: ["adId"], where: { businessId, adId: { in: adIds } }, _count: { _all: true } }),
    prisma.lead.findMany({ where: { businessId, contact: { adId: { in: adIds } } }, select: { contact: { select: { adId: true } } } }),
  ]);
  const map = new Map<string, { chats: number; leads: number }>();
  for (const id of adIds) map.set(id, { chats: 0, leads: 0 });
  for (const c of chats) if (c.adId) map.get(c.adId)!.chats = c._count._all;
  for (const l of leads) if (l.contact.adId) map.get(l.contact.adId)!.leads++;
  return map;
}

adsRouter.get("/status", async (req, res) => {
  const businessId = bid(req);
  const account = await prisma.metaAccount.findUnique({ where: { businessId } });
  const pages = await prisma.connectedPage.findMany({
    where: { businessId, kind: "FACEBOOK_LOGIN" },
    select: { id: true, name: true, fbPageId: true, igAccountId: true, igUsername: true, pictureUrl: true },
  });
  const permission = account ? await ads.hasAdsPermission(decrypt(account.accessToken)) : false;
  res.json({ metaConfigured: config.meta.enabled, connected: !!account, permission, pages });
});

adsRouter.get("/accounts", async (req, res) => {
  res.json(await ads.listAdAccounts(await userToken(bid(req))));
});

adsRouter.post("/estimate", async (req, res) => {
  const body = parse(
    z.object({ adAccountId: z.string(), destination: z.enum(["MESSENGER", "INSTAGRAM_DIRECT"]), targeting: TargetingSchema }),
    req.body,
  );
  const token = await userToken(bid(req));
  const geo = await ads.resolveGeo(token, body.targeting);
  res.json(await ads.estimateAudience(token, body.adAccountId, ads.buildTargeting(body.targeting, geo, body.destination)));
});

adsRouter.get("/", async (req, res) => {
  const businessId = bid(req);
  const list = await prisma.adCampaign.findMany({ where: { businessId }, orderBy: { createdAt: "desc" } });
  const results = await ourResults(businessId, list.map((c) => c.metaAdId).filter((x): x is string => !!x));
  res.json(list.map((c) => ({ ...c, results: (c.metaAdId && results.get(c.metaAdId)) || { chats: 0, leads: 0 } })));
});

const CreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  pageId: z.string(),
  adAccountId: z.string().regex(/^act_\d+$/),
  currency: z.string().length(3),
  destination: z.enum(["MESSENGER", "INSTAGRAM_DIRECT"]),
  targeting: TargetingSchema,
  dailyBudget: z.number().positive().max(100_000_000),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  primaryText: z.string().trim().min(1).max(2000),
  headline: z.string().trim().min(1).max(100),
  activate: z.boolean().default(true),
});

/** multipart: field "data" (JSON) + file "image" */
adsRouter.post("/", upload.single("image"), async (req, res) => {
  const businessId = bid(req);
  let raw: unknown;
  try {
    raw = JSON.parse(String(req.body?.data ?? "{}"));
  } catch {
    throw badRequest("Invalid data");
  }
  const body = parse(CreateSchema, raw);
  if (!req.file) throw badRequest("Зарын зураг оруулна уу");
  if (body.endAt && body.endAt <= body.startAt) throw badRequest("Дуусах огноо эхлэхээс хойш байх ёстой");
  const page = await prisma.connectedPage.findFirst({ where: { id: body.pageId, businessId, kind: "FACEBOOK_LOGIN" } });
  if (!page?.fbPageId) throw badRequest("Зар явуулахын тулд Facebook пэйж холбосон байх шаардлагатай");
  if (body.destination === "INSTAGRAM_DIRECT" && !page.igAccountId) throw badRequest("Энэ пэйжид Instagram холбогдоогүй байна");

  const token = await userToken(businessId);
  const draft = await prisma.adCampaign.create({
    data: {
      businessId,
      pageId: page.id,
      adAccountId: body.adAccountId,
      currency: body.currency,
      name: body.name,
      destination: body.destination,
      status: "DRAFT",
      targeting: body.targeting,
      dailyBudget: body.dailyBudget,
      startAt: body.startAt,
      endAt: body.endAt ?? null,
      primaryText: body.primaryText,
      headline: body.headline,
    },
  });

  try {
    const geo = await ads.resolveGeo(token, body.targeting);
    const image = await ads.uploadImage(token, body.adAccountId, req.file.buffer);
    const r = await ads.createClickToMessageAd({
      userToken: token,
      adAccountId: body.adAccountId,
      currency: body.currency,
      name: body.name,
      pageId: page.fbPageId,
      igAccountId: page.igAccountId,
      destination: body.destination,
      targeting: ads.buildTargeting(body.targeting, geo, body.destination),
      dailyBudget: body.dailyBudget,
      startAt: body.startAt,
      endAt: body.endAt ?? null,
      primaryText: body.primaryText,
      headline: body.headline,
      imageHash: image.hash,
      activate: body.activate,
    });
    const saved = await prisma.adCampaign.update({
      where: { id: draft.id },
      data: {
        status: body.activate ? "ACTIVE" : "PAUSED",
        imageUrl: image.url,
        metaCampaignId: r.campaignId,
        metaAdSetId: r.adSetId,
        metaCreativeId: r.creativeId,
        metaAdId: r.adId,
      },
    });
    res.status(201).json(saved);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.adCampaign.update({ where: { id: draft.id }, data: { status: "FAILED", error: msg } });
    throw badRequest(`Meta зар үүсгэж чадсангүй: ${msg}`, "AD_FAILED");
  }
});

async function own(req: Parameters<typeof bid>[0]): Promise<AdCampaign> {
  const c = await prisma.adCampaign.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!c) throw notFound();
  return c;
}

adsRouter.post("/:id/status", async (req, res) => {
  const c = await own(req);
  const { status } = parse(z.object({ status: z.enum(["ACTIVE", "PAUSED"]) }), req.body);
  if (!c.metaCampaignId || !c.metaAdSetId || !c.metaAdId) throw badRequest("Зар Meta дээр үүсээгүй байна");
  await ads.setStatus(await userToken(c.businessId), [c.metaCampaignId, c.metaAdSetId, c.metaAdId], status);
  res.json(await prisma.adCampaign.update({ where: { id: c.id }, data: { status } }));
});

export async function syncAdStats(c: AdCampaign) {
  if (!c.metaCampaignId || !c.metaAdId) return c;
  const r = await ads.fetchAdStats(await userToken(c.businessId), c.metaCampaignId, c.metaAdId);
  return prisma.adCampaign.update({
    where: { id: c.id },
    data: { stats: r.stats, metaStatus: r.effectiveStatus, statsUpdatedAt: new Date() },
  });
}

adsRouter.post("/:id/sync", async (req, res) => {
  res.json(await syncAdStats(await own(req)));
});

adsRouter.delete("/:id", async (req, res) => {
  const c = await own(req);
  if (c.metaCampaignId) await ads.deleteCampaign(await userToken(c.businessId), c.metaCampaignId);
  await prisma.adCampaign.delete({ where: { id: c.id } });
  res.json({ ok: true });
});
