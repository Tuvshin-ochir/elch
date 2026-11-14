/**
 * Meta app callbacks required to publish the Facebook and Instagram apps:
 *  - Deauthorize: the user removed our app in Facebook / Instagram settings
 *  - Data deletion: the user asked Meta to have us delete their data
 *
 * Both arrive as a form POST with a `signed_request` (HMAC-SHA256 with the app secret).
 * We delete what we obtained through that login: access tokens, connected pages/accounts,
 * the page content synced into the knowledge base, and the profile link on the owner account.
 * Business data the owner typed in themselves (products, FAQ…) is kept — it isn't Meta data.
 */
import crypto from "node:crypto";
import express, { Router } from "express";
import { config } from "../config.ts";
import { badRequest, notFound, param } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";

export const metaCallbacksRouter = Router();
metaCallbacksRouter.use(express.urlencoded({ extended: false }));

type Provider = "facebook" | "instagram";

function secretFor(provider: Provider) {
  return provider === "facebook" ? config.meta.appSecret : config.instagram.appSecret;
}

/** Verify and decode Meta's signed_request → app-scoped user id */
export function parseSignedRequest(signed: unknown, secret: string): { user_id: string } | null {
  if (typeof signed !== "string" || !secret) return null;
  const [sig, payload] = signed.split(".", 2);
  if (!sig || !payload) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  const got = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (got.length !== expected.length || !crypto.timingSafeEqual(got, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8")) as {
      algorithm?: string;
      user_id?: string | number;
    };
    if (data.algorithm?.toUpperCase() !== "HMAC-SHA256" || data.user_id === undefined) return null;
    return { user_id: String(data.user_id) };
  } catch {
    return null;
  }
}

/** Remove everything we obtained through this Facebook / Instagram login */
async function revokeMetaData(provider: Provider, externalUserId: string) {
  const result = { pages: 0, knowledge: 0, metaAccount: false, unlinkedUser: false };

  if (provider === "facebook") {
    const [user, metaAccounts] = await Promise.all([
      prisma.user.findUnique({ where: { fbUserId: externalUserId }, select: { id: true, business: { select: { id: true } } } }),
      prisma.metaAccount.findMany({ where: { fbUserId: externalUserId }, select: { businessId: true } }),
    ]);
    const businessIds = [...new Set([user?.business?.id, ...metaAccounts.map((m) => m.businessId)].filter((x): x is string => !!x))];
    for (const businessId of businessIds) {
      const pages = await prisma.connectedPage.findMany({ where: { businessId, kind: "FACEBOOK_LOGIN" }, select: { id: true } });
      result.knowledge += (await prisma.knowledgeSource.deleteMany({ where: { businessId, type: "PAGE_SYNC", sourceRef: { in: pages.map((p) => p.id) } } })).count;
      result.pages += (await prisma.connectedPage.deleteMany({ where: { id: { in: pages.map((p) => p.id) } } })).count;
      result.metaAccount = (await prisma.metaAccount.deleteMany({ where: { businessId } })).count > 0 || result.metaAccount;
    }
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { fbUserId: null, avatarUrl: null } });
      result.unlinkedUser = true;
    }
  } else {
    const [user, pages] = await Promise.all([
      prisma.user.findUnique({ where: { igUserId: externalUserId }, select: { id: true } }),
      prisma.connectedPage.findMany({ where: { kind: "INSTAGRAM_LOGIN", igAccountId: externalUserId }, select: { id: true } }),
    ]);
    result.knowledge += (await prisma.knowledgeSource.deleteMany({ where: { type: "PAGE_SYNC", sourceRef: { in: pages.map((p) => p.id) } } })).count;
    result.pages += (await prisma.connectedPage.deleteMany({ where: { id: { in: pages.map((p) => p.id) } } })).count;
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { igUserId: null, avatarUrl: null } });
      result.unlinkedUser = true;
    }
  }
  return result;
}

async function handle(provider: Provider, kind: "deletion" | "deauthorize", signed: unknown) {
  const data = parseSignedRequest(signed, secretFor(provider));
  if (!data) throw badRequest("Invalid signed_request", "INVALID_SIGNATURE");
  const result = await revokeMetaData(provider, data.user_id);
  const code = crypto.randomBytes(9).toString("base64url");
  await prisma.dataDeletionRequest.create({
    data: { code, provider, kind, externalUserId: data.user_id, result, completedAt: new Date() },
  });
  console.log(`[meta] ${provider} ${kind} for ${data.user_id}:`, result);
  return code;
}

for (const provider of ["facebook", "instagram"] as const) {
  metaCallbacksRouter.post(`/${provider}/deauthorize`, async (req, res) => {
    await handle(provider, "deauthorize", req.body?.signed_request);
    res.json({ ok: true });
  });

  /** Meta expects { url, confirmation_code } — the url lets the user check the status */
  metaCallbacksRouter.post(`/${provider}/data-deletion`, async (req, res) => {
    const code = await handle(provider, "deletion", req.body?.signed_request);
    res.json({ url: `${config.appUrl}/data-deletion?code=${code}`, confirmation_code: code });
  });
}

/** Public status lookup for the /data-deletion page */
metaCallbacksRouter.get("/deletion/:code", async (req, res) => {
  const r = await prisma.dataDeletionRequest.findUnique({
    where: { code: param(req, "code") },
    select: { code: true, provider: true, createdAt: true, completedAt: true },
  });
  if (!r) throw notFound("Хүсэлт олдсонгүй");
  res.json({ ...r, status: r.completedAt ? "COMPLETED" : "PENDING" });
});
