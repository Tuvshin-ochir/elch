import { prisma, type TagSource } from "../lib/prisma.ts";
import { emit } from "./realtime.ts";

/**
 * Tagging — 4 ways a contact gets tagged:
 *  1. MANUAL  — agent tags in inbox / contacts
 *  2. KEYWORD — message contains a keyword from a rule
 *  3. AI      — Claude classifies the intent against AI_INTENT rules
 *  4. COMMENT — the user commented on a post (optionally a specific post / keyword)
 * Adding a tag also schedules TAG_TRIGGER broadcasts.
 */
export async function applyTag(contactId: string, tagId: string, source: TagSource) {
  const existing = await prisma.contactTag.findUnique({ where: { contactId_tagId: { contactId, tagId } } });
  if (existing) return false;
  const ct = await prisma.contactTag.create({ data: { contactId, tagId, source } });
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });

  // Schedule TAG_TRIGGER sequences for this tag
  const triggers = await prisma.broadcast.findMany({
    where: { businessId: contact.businessId, type: "TAG_TRIGGER", status: "ACTIVE", tagIds: { has: tagId } },
  });
  for (const b of triggers) {
    await prisma.broadcastDelivery
      .create({
        data: {
          broadcastId: b.id,
          contactId,
          anchor: `tag:${tagId}:${ct.createdAt.toISOString()}`,
          sendAt: new Date(ct.createdAt.getTime() + (b.delayMinutes ?? 0) * 60_000),
        },
      })
      .catch(() => undefined); // unique → already scheduled
  }
  emit(contact.businessId, { type: "contact", contactId });
  return true;
}

export async function removeTag(contactId: string, tagId: string) {
  await prisma.contactTag.deleteMany({ where: { contactId, tagId } });
}

const norm = (s: string) => s.toLowerCase().normalize("NFC");

export function matchesKeywords(text: string, keywords: string[]): boolean {
  const t = norm(text);
  return keywords.some((k) => k.trim() && t.includes(norm(k.trim())));
}

export async function applyKeywordRules(businessId: string, contactId: string, text: string) {
  if (!text.trim()) return;
  const rules = await prisma.tagRule.findMany({ where: { businessId, type: "KEYWORD", active: true } });
  for (const r of rules) {
    if (matchesKeywords(text, r.keywords)) await applyTag(contactId, r.tagId, "KEYWORD");
  }
}

export async function applyCommentRules(args: { businessId: string; contactId: string; postId?: string; text: string }) {
  const rules = await prisma.tagRule.findMany({ where: { businessId: args.businessId, type: "COMMENT", active: true } });
  for (const r of rules) {
    if (r.postId && r.postId !== args.postId) continue;
    if (r.keywords.length && !matchesKeywords(args.text, r.keywords)) continue;
    await applyTag(args.contactId, r.tagId, "COMMENT");
  }
}

/** Intent descriptions that Claude classifies against (AI tagging). */
export async function aiIntentRules(businessId: string) {
  const rules = await prisma.tagRule.findMany({
    where: { businessId, type: "AI_INTENT", active: true },
    include: { tag: true },
  });
  return rules.map((r) => ({ name: r.tag.name, description: r.intent ?? r.tag.name, tagId: r.tagId }));
}
