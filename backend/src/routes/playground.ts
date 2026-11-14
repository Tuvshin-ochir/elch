import { Router } from "express";
import { z } from "zod";
import { badRequest, parse } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { describeAnthropicError } from "../services/ai/claude.ts";
import { replyNow } from "../services/chat/engine.ts";
import { applyKeywordRules } from "../services/tagging.ts";

/** Test the bot from the dashboard before connecting a real page. */
export const playgroundRouter = Router();
playgroundRouter.use(requireAuth);

async function playgroundContact(businessId: string) {
  const externalId = `playground:${businessId}`;
  return prisma.contact.upsert({
    where: { businessId_platform_externalId: { businessId, platform: "FACEBOOK", externalId } },
    create: { businessId, platform: "FACEBOOK", externalId, name: "Тест хэрэглэгч" },
    update: {},
  });
}

playgroundRouter.get("/", async (req, res) => {
  const c = await playgroundContact(bid(req));
  const [messages, tags, leads] = await Promise.all([
    prisma.message.findMany({ where: { contactId: c.id }, orderBy: { createdAt: "asc" }, take: 100 }),
    prisma.contactTag.findMany({ where: { contactId: c.id }, include: { tag: true } }),
    prisma.lead.findMany({ where: { contactId: c.id }, orderBy: { createdAt: "desc" } }),
  ]);
  res.json({ messages, tags: tags.map((t) => ({ ...t.tag, source: t.source })), leads, contact: c });
});

playgroundRouter.post("/message", async (req, res) => {
  const businessId = bid(req);
  const { text } = parse(z.object({ text: z.string().trim().min(1).max(2000) }), req.body);
  const c = await playgroundContact(businessId);
  const now = new Date();
  await prisma.message.create({
    data: { businessId, contactId: c.id, direction: "IN", sender: "CUSTOMER", text },
  });
  await prisma.contact.update({
    where: { id: c.id },
    data: { lastInboundAt: now, lastMessageAt: now, lastMessageText: text.slice(0, 200) },
  });
  await applyKeywordRules(businessId, c.id, text);
  try {
    const out = await replyNow(c.id);
    if ("skipped" in out) {
      const reasons: Record<string, string> = {
        subscription_inactive: "Багц идэвхгүй байна. Төлбөрөө төлж идэвхжүүлнэ үү.",
        ai_limit_reached: "Энэ сарын AI хариултын лимит дууссан.",
      };
      throw badRequest(reasons[out.skipped] ?? out.skipped, out.skipped.toUpperCase());
    }
    res.json(out);
  } catch (err) {
    if (err instanceof Error && "status" in err) throw err;
    throw badRequest(describeAnthropicError(err), "AI_ERROR");
  }
});

playgroundRouter.post("/reset", async (req, res) => {
  const c = await playgroundContact(bid(req));
  await prisma.contact.delete({ where: { id: c.id } });
  res.json({ ok: true });
});
