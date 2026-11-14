import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.ts";
import { decrypt, encrypt } from "../lib/crypto.ts";
import { badRequest, notFound, param, parse, planLimit } from "../lib/http.ts";
import { prisma, type ConnectedPage } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { getPlanContext } from "../services/billing/subscription.ts";
import { syncPageKnowledge } from "../services/knowledge/pageSync.ts";
import { ADS_SCOPES } from "../services/meta/ads.ts";
import * as graph from "../services/meta/graph.ts";

function serializePage(p: ConnectedPage) {
  const { accessToken: _t, ...rest } = p;
  return rest;
}

async function assertConnectionSlot(businessId: string) {
  const { plan } = await getPlanContext(businessId);
  const count = await prisma.connectedPage.count({ where: { businessId } });
  if (count >= plan.limits.pages) {
    throw planLimit(`Таны багц ${plan.limits.pages} холболт хийх эрхтэй. Багцаа ахиулна уу.`);
  }
}

// ───────── Authenticated ─────────

export const metaRouter = Router();
metaRouter.use(requireAuth);

metaRouter.get("/status", async (req, res) => {
  const businessId = bid(req);
  const [account, pages] = await Promise.all([
    prisma.metaAccount.findUnique({ where: { businessId }, select: { fbUserName: true, expiresAt: true } }),
    prisma.connectedPage.findMany({ where: { businessId }, orderBy: { createdAt: "asc" } }),
  ]);
  res.json({
    configured: config.meta.enabled,
    igConfigured: config.instagram.enabled,
    webhookUrl: `${config.publicApiUrl}/webhooks/meta`,
    igRedirectUrl: graph.igRedirectUri(),
    fbRedirectUrl: graph.fbRedirectUri(),
    verifyToken: config.meta.verifyToken,
    account,
    pages: pages.map(serializePage),
  });
});

// ── Facebook Login ──

metaRouter.get("/oauth-url", (req, res) => {
  if (!config.meta.enabled) throw badRequest("META_APP_ID / META_APP_SECRET тохируулаагүй байна", "META_NOT_CONFIGURED");
  const state = jwt.sign({ kind: "connect", bid: bid(req) }, config.jwtSecret, { expiresIn: "15m" });
  // ?ads=1 also asks for ads permissions (Click-to-Message ad builder)
  const extra = req.query.ads === "1" ? ADS_SCOPES : [];
  res.json({ url: graph.oauthDialogUrl(graph.fbRedirectUri(), state, extra) });
});

metaRouter.get("/available-pages", async (req, res) => {
  const businessId = bid(req);
  const account = await prisma.metaAccount.findUnique({ where: { businessId } });
  if (!account) throw badRequest("Facebook холбогдоогүй байна", "META_NOT_CONNECTED");
  const pages = await graph.listPages(decrypt(account.accessToken));
  const connected = await prisma.connectedPage.findMany({
    where: { fbPageId: { in: pages.map((p) => p.id) } },
    select: { fbPageId: true, businessId: true },
  });
  res.json(
    pages.map((p) => {
      const c = connected.find((x) => x.fbPageId === p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        picture: p.picture?.data?.url,
        instagram: p.instagram_business_account ?? null,
        connected: c?.businessId === businessId,
        connectedElsewhere: !!c && c.businessId !== businessId,
      };
    }),
  );
});

/** Connect a FB page. `channels` = which of Messenger / its linked Instagram to automate. */
metaRouter.post("/pages", async (req, res) => {
  const businessId = bid(req);
  const body = parse(
    z.object({ fbPageId: z.string(), fbEnabled: z.boolean().default(true), igEnabled: z.boolean().default(true) }),
    req.body,
  );
  const account = await prisma.metaAccount.findUnique({ where: { businessId } });
  if (!account) throw badRequest("Facebook холбогдоогүй байна");
  const pages = await graph.listPages(decrypt(account.accessToken));
  const p = pages.find((x) => x.id === body.fbPageId);
  if (!p) throw notFound("Page not found in your Facebook account");
  const other = await prisma.connectedPage.findUnique({ where: { fbPageId: body.fbPageId } });
  if (other && other.businessId !== businessId) throw badRequest("Энэ пэйж өөр бүртгэлд холбогдсон байна");

  // The same Instagram may already be connected on its own via Instagram Login → merge into this page
  const igId = p.instagram_business_account?.id ?? null;
  const igStandalone = igId ? await prisma.connectedPage.findUnique({ where: { igAccountId: igId } }) : null;
  if (igStandalone && igStandalone.businessId !== businessId) throw badRequest("Энэ пэйжийн Instagram өөр бүртгэлд холбогдсон байна");
  if (!other && !igStandalone) await assertConnectionSlot(businessId);

  await graph.subscribePage(p.id, p.access_token);
  const data = {
    kind: "FACEBOOK_LOGIN" as const,
    fbPageId: p.id,
    name: p.name,
    category: p.category,
    pictureUrl: p.picture?.data?.url,
    accessToken: encrypt(p.access_token),
    tokenExpiresAt: null,
    igAccountId: igId,
    igUsername: p.instagram_business_account?.username ?? null,
    fbEnabled: body.fbEnabled,
    igEnabled: igId ? body.igEnabled : false,
  };
  let page: ConnectedPage;
  if (other) page = await prisma.connectedPage.update({ where: { id: other.id }, data });
  else if (igStandalone) {
    await unsubscribe(igStandalone);
    page = await prisma.connectedPage.update({ where: { id: igStandalone.id }, data });
  } else page = await prisma.connectedPage.create({ data: { businessId, ...data } });

  syncPageKnowledge(page.id).catch((e) => console.error("[page-sync]", e));
  res.status(201).json(serializePage(page));
});

// ── Instagram Login ──

metaRouter.get("/ig/oauth-url", (req, res) => {
  const mode = config.instagramConnect;
  if (!mode) throw badRequest("Instagram холболт тохируулагдаагүй байна (META_IG_CONFIG_ID, https)", "IG_NOT_CONFIGURED");
  const state = jwt.sign({ kind: "connect", bid: bid(req) }, config.jwtSecret, { expiresIn: "15m" });
  res.json({ url: mode === "unified" ? graph.unifiedLoginUrl(graph.igRedirectUri(), state) : graph.igOauthDialogUrl(graph.igRedirectUri(), state) });
});

// ── Per-connection settings ──

metaRouter.patch("/pages/:id", async (req, res) => {
  const businessId = bid(req);
  const body = parse(
    z.object({
      fbEnabled: z.boolean().optional(),
      igEnabled: z.boolean().optional(),
      commentAutoReply: z.boolean().optional(),
      commentReplyText: z.string().max(1000).nullable().optional(),
      commentDmText: z.string().max(1000).nullable().optional(),
    }),
    req.body,
  );
  if (body.commentAutoReply) {
    const { plan } = await getPlanContext(businessId);
    if (!plan.features.commentAutoReply) throw planLimit("Коммент автомат хариулт Бизнес болон Про багцад байна");
  }
  const page = await prisma.connectedPage.findFirst({ where: { id: param(req, "id"), businessId } });
  if (!page) throw notFound();
  if (body.commentAutoReply && !graph.commentScopesEnabled(page.kind)) {
    throw badRequest("Коммент автомат хариулт одоогоор идэвхгүй байна — платформын Meta аппад коммент удирдах эрх нэмэгдээгүй", "COMMENT_SCOPES_MISSING");
  }
  if (body.fbEnabled && !page.fbPageId) throw badRequest("Энэ холболтод Facebook пэйж алга");
  if (body.igEnabled && !page.igAccountId) throw badRequest("Энэ пэйжид Instagram холбогдоогүй байна");
  const updated = await prisma.connectedPage.update({ where: { id: page.id }, data: body });
  res.json(serializePage(updated));
});

metaRouter.post("/pages/:id/sync", async (req, res) => {
  const page = await prisma.connectedPage.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!page) throw notFound();
  await syncPageKnowledge(page.id);
  res.json({ ok: true });
});

async function unsubscribe(page: ConnectedPage) {
  const token = decrypt(page.accessToken);
  if (page.kind === "INSTAGRAM_LOGIN") await graph.igUnsubscribe(token);
  else if (page.kind === "INSTAGRAM_UNIFIED") {
    if (page.igAccountId) await graph.unifiedUnsubscribe(page.igAccountId, token);
  } else if (page.fbPageId) await graph.unsubscribePage(page.fbPageId, token);
}

metaRouter.delete("/pages/:id", async (req, res) => {
  const page = await prisma.connectedPage.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!page) throw notFound();
  await unsubscribe(page);
  await prisma.knowledgeSource.deleteMany({ where: { businessId: page.businessId, type: "PAGE_SYNC", sourceRef: page.id } });
  await prisma.connectedPage.delete({ where: { id: page.id } });
  res.json({ ok: true });
});

/** Disconnect the Facebook account and its pages (standalone Instagram connections stay). */
metaRouter.post("/disconnect", async (req, res) => {
  const businessId = bid(req);
  const pages = await prisma.connectedPage.findMany({ where: { businessId, kind: "FACEBOOK_LOGIN" } });
  for (const p of pages) await unsubscribe(p);
  await prisma.connectedPage.deleteMany({ where: { businessId, kind: "FACEBOOK_LOGIN" } });
  await prisma.metaAccount.deleteMany({ where: { businessId } });
  res.json({ ok: true });
});
