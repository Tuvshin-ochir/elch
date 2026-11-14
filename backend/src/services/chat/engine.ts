import { widgetSettingsOf, type BotSettings } from "../../businessTypes.ts";
import { normalizeCity, normalizeDistrict, UB } from "../../locations.ts";
import { prisma, type Contact, type ConnectedPage, type Platform } from "../../lib/prisma.ts";
import { generateReply, type BotReply, type ChatTurn } from "../ai/responder.ts";
import { aiRepliesUsed, getPlanContext } from "../billing/subscription.ts";
import { buildKnowledge } from "../knowledge/retrieve.ts";
import { emit } from "../realtime.ts";
import { aiIntentRules, applyKeywordRules, applyTag } from "../tagging.ts";
import { isPlayground, sendToContact, typing } from "./send.ts";

type ContactWithPage = Contact & { page: ConnectedPage | null };

/** The owner chooses per connection whether Messenger and/or Instagram is automated. */
export function channelEnabled(page: ConnectedPage, platform: Platform) {
  if (platform === "INSTAGRAM") return page.igEnabled;
  if (platform === "FACEBOOK") return page.fbEnabled;
  return false;
}

/** Wait this long for follow-up messages before answering (people often send 2-3 short messages). */
const DEBOUNCE_MS = 2_500;
const HANDOFF_PAUSE_MS = 12 * 3600 * 1000;

const timers = new Map<string, NodeJS.Timeout>();

/** Store an inbound customer message and schedule the AI reply. */
export async function receiveCustomerMessage(args: {
  contact: ContactWithPage;
  text: string;
  imageUrls?: string[];
  mid?: string;
}) {
  const { contact } = args;
  if (args.mid && (await prisma.message.findUnique({ where: { mid: args.mid } }))) return; // webhook retry

  const now = new Date();
  const msg = await prisma.message.create({
    data: {
      businessId: contact.businessId,
      contactId: contact.id,
      direction: "IN",
      sender: "CUSTOMER",
      text: args.text,
      attachments: args.imageUrls?.length ? { images: args.imageUrls } : undefined,
      mid: args.mid ?? null,
    },
  });
  await prisma.contact.update({
    where: { id: contact.id },
    data: {
      lastInboundAt: now,
      lastMessageAt: now,
      lastMessageText: (args.text || "📷").slice(0, 200),
      unread: { increment: 1 },
    },
  });
  emit(contact.businessId, { type: "message", contactId: contact.id, message: msg });

  await applyKeywordRules(contact.businessId, contact.id, args.text);

  clearTimeout(timers.get(contact.id));
  timers.set(
    contact.id,
    setTimeout(() => {
      timers.delete(contact.id);
      replyNow(contact.id).catch((err) => console.error("[bot] reply failed", contact.id, err));
    }, DEBOUNCE_MS),
  );
}

export type ReplyOutcome = { reply: BotReply; messageId: string } | { skipped: string };

/** Generate + send the bot's reply to everything the customer said since our last message. */
export async function replyNow(contactId: string): Promise<ReplyOutcome> {
  const contact = await prisma.contact.findUniqueOrThrow({
    where: { id: contactId },
    include: { page: true, business: true, tags: { include: { tag: true } } },
  });
  const settings = (contact.business.botSettings ?? {}) as BotSettings;
  const { sub, plan, active } = await getPlanContext(contact.businessId);
  const playground = isPlayground(contact);

  // ── Guards ── (no free trial: everything, including the test chat, needs a paid plan)
  if (!active) return { skipped: "subscription_inactive" };
  if (!playground) {
    if (settings.enabled === false) return { skipped: "bot_disabled" };
    if (contact.platform === "WEB" && !widgetSettingsOf(contact.business.widgetSettings).enabled) return { skipped: "channel_disabled" };
    if (contact.page && !channelEnabled(contact.page, contact.platform)) return { skipped: "channel_disabled" };
    if (contact.botPausedUntil && contact.botPausedUntil > new Date()) return { skipped: "human_takeover" };
  }
  if ((await aiRepliesUsed(contact.businessId, sub)) >= plan.limits.aiReplies) {
    await prisma.contact.update({ where: { id: contact.id }, data: { needsHuman: true } });
    return { skipped: "ai_limit_reached" };
  }

  // ── Conversation history ──
  const recent = await prisma.message.findMany({
    where: { contactId, sender: { not: "SYSTEM" } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  recent.reverse();
  if (!recent.length || recent[recent.length - 1].direction !== "IN") return { skipped: "nothing_to_answer" };

  const history: ChatTurn[] = recent.map((m) => ({
    role: m.direction === "IN" ? "user" : "assistant",
    text: m.text,
    imageUrls: ((m.attachments as { images?: string[] } | null)?.images ?? []).filter(Boolean),
  }));
  const pending = [];
  for (let i = recent.length - 1; i >= 0 && recent[i].direction === "IN"; i--) pending.unshift(recent[i].text);
  const query = pending.join(" ");

  const [knowledge, intents] = await Promise.all([
    buildKnowledge(contact.businessId, query),
    plan.features.aiTagging ? aiIntentRules(contact.businessId) : Promise.resolve([]),
  ]);

  const channelName = { FACEBOOK: "Facebook Messenger", INSTAGRAM: "Instagram Direct", WEB: "the business website chat" }[contact.platform];
  const contactInfo = [
    `Channel: ${channelName}`,
    contact.name ? `Customer name: ${contact.name}` : null,
    contact.phone ? `Customer phone on file: ${contact.phone}` : null,
    contact.tags.length ? `Customer tags: ${contact.tags.map((t) => t.tag.name).join(", ")}` : null,
    recent.some((m) => m.direction === "OUT") ? "This is an ongoing conversation." : "This is the start of a new conversation.",
  ]
    .filter(Boolean)
    .join("\n");

  await typing(contact);

  let reply: BotReply;
  try {
    reply = await generateReply({
      businessName: contact.business.name,
      settings,
      knowledge,
      intents,
      contactInfo,
      history,
      allowImages: plan.features.imageUnderstanding,
    });
  } catch (err) {
    // Don't leave the customer hanging silently — surface the chat to staff
    if (!playground) {
      await prisma.contact.update({ where: { id: contact.id }, data: { needsHuman: true } });
      emit(contact.businessId, { type: "contact", contactId: contact.id });
    }
    throw err;
  }

  // A newer customer message may have arrived while Claude was thinking — let that run answer.
  const newer = await prisma.message.findFirst({
    where: { contactId, direction: "IN", createdAt: { gt: recent[recent.length - 1].createdAt } },
  });
  if (newer && !playground) return { skipped: "superseded" };

  const sent = await sendToContact({ contact, text: reply.reply, sender: "BOT" }).catch((err) => {
    console.error("[bot] send failed", err);
    return null;
  });

  // ── Side effects: tags, lead, contact info, handoff ──
  for (const name of reply.intents) {
    const rule = intents.find((i) => i.name.toLowerCase() === name.toLowerCase());
    if (rule) await applyTag(contact.id, rule.tagId, "AI");
  }
  if (reply.lead && plan.features.leadCapture) {
    await prisma.lead.create({
      data: {
        businessId: contact.businessId,
        contactId: contact.id,
        type: reply.lead.type,
        name: reply.lead.name ?? reply.customer_name ?? contact.name,
        phone: reply.lead.phone ?? reply.customer_phone ?? contact.phone,
        details: reply.lead.details,
      },
    });
    emit(contact.businessId, { type: "lead", contactId: contact.id });
  }
  const contactUpdate: Record<string, unknown> = {};
  if (reply.customer_phone && !contact.phone) contactUpdate.phone = reply.customer_phone;
  if (reply.customer_name && !contact.name) contactUpdate.name = reply.customer_name;
  const prof = reply.customer_profile;
  if (prof) {
    if (prof.age && prof.age >= 10 && prof.age <= 100) contactUpdate.birthYear = new Date().getFullYear() - prof.age;
    if (prof.gender) contactUpdate.gender = prof.gender;
    const district = normalizeDistrict(prof.district);
    const city = normalizeCity(prof.city) ?? (district ? UB : null);
    if (city) contactUpdate.city = city;
    if (district) contactUpdate.district = district;
  }
  if (reply.handoff) {
    contactUpdate.needsHuman = true;
    if (!playground) contactUpdate.botPausedUntil = new Date(Date.now() + HANDOFF_PAUSE_MS);
  }
  if (Object.keys(contactUpdate).length) {
    await prisma.contact.update({ where: { id: contact.id }, data: contactUpdate });
    emit(contact.businessId, { type: "contact", contactId: contact.id });
  }

  return { reply, messageId: sent?.id ?? "" };
}
