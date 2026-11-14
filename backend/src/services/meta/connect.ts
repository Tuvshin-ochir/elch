import { encrypt } from "../../lib/crypto.ts";
import { prisma, type ConnectedPage } from "../../lib/prisma.ts";
import { getPlanContext } from "../billing/subscription.ts";
import { syncPageKnowledge } from "../knowledge/pageSync.ts";
import * as graph from "./graph.ts";

/** Attach an Instagram account (from Instagram Login) to a business as a channel. */
export async function connectInstagramAccount(
  businessId: string,
  r: Awaited<ReturnType<typeof graph.igExchangeCode>>,
): Promise<ConnectedPage> {
  const existing = await prisma.connectedPage.findUnique({ where: { igAccountId: r.igAccountId } });
  if (existing && existing.businessId !== businessId) throw new Error("Энэ Instagram өөр бүртгэлд холбогдсон байна");

  let page: ConnectedPage;
  if (existing?.kind === "FACEBOOK_LOGIN") {
    // Already reachable through its Facebook page — just make sure Instagram automation is on
    page = await prisma.connectedPage.update({ where: { id: existing.id }, data: { igEnabled: true } });
  } else {
    if (!existing) {
      const { plan } = await getPlanContext(businessId);
      const count = await prisma.connectedPage.count({ where: { businessId } });
      if (count >= plan.limits.pages) throw new Error(`Таны багц ${plan.limits.pages} холболт хийх эрхтэй. Багцаа ахиулна уу.`);
    }
    await graph.igSubscribe(r.accessToken);
    const data = {
      kind: "INSTAGRAM_LOGIN" as const,
      name: r.name,
      pictureUrl: r.picture ?? null,
      accessToken: encrypt(r.accessToken),
      tokenExpiresAt: r.expiresAt,
      igUsername: r.username,
      fbEnabled: false,
      igEnabled: true,
    };
    page = existing
      ? await prisma.connectedPage.update({ where: { id: existing.id }, data })
      : await prisma.connectedPage.create({ data: { businessId, igAccountId: r.igAccountId, ...data } });
  }
  syncPageKnowledge(page.id).catch((e) => console.error("[ig-sync]", e));
  return page;
}

/** Store the Facebook user token (lets the owner pick pages to connect). */
export async function saveMetaAccount(businessId: string, r: Awaited<ReturnType<typeof graph.exchangeCode>>) {
  await prisma.metaAccount.upsert({
    where: { businessId },
    create: { businessId, fbUserId: r.userId, fbUserName: r.userName, accessToken: encrypt(r.accessToken), expiresAt: r.expiresAt },
    update: { fbUserId: r.userId, fbUserName: r.userName, accessToken: encrypt(r.accessToken), expiresAt: r.expiresAt },
  });
}
