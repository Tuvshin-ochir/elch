import { config } from "../../config.ts";
import { decrypt } from "../../lib/crypto.ts";
import { prisma, type ConnectedPage, type Platform } from "../../lib/prisma.ts";
import { PLANS } from "../../plans.ts";
import { channelEnabled, receiveCustomerMessage } from "../chat/engine.ts";
import { wasSentByUs } from "../chat/send.ts";
import { emit } from "../realtime.ts";
import { applyCommentRules, applyTag } from "../tagging.ts";
import * as graph from "./graph.ts";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const HUMAN_TAKEOVER_MS = 12 * 3600 * 1000;

async function upsertContact(page: ConnectedPage, platform: Platform, externalId: string, nameHint?: string) {
  const existing = await prisma.contact.findUnique({
    where: { businessId_platform_externalId: { businessId: page.businessId, platform, externalId } },
    include: { page: true },
  });
  if (existing) return existing;

  const token = decrypt(page.accessToken);
  let name = nameHint;
  let username: string | undefined;
  let profilePic: string | undefined;
  if (platform === "FACEBOOK") {
    const p = await graph.getMessengerProfile(token, externalId);
    if (p) {
      name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.name || name;
      profilePic = p.profile_pic;
    }
  } else {
    const p = await graph.getInstagramProfile(graph.apiFor(page.kind), token, externalId);
    if (p) {
      name = p.name || p.username || name;
      username = p.username;
      profilePic = p.profile_pic;
    }
  }
  return prisma.contact.upsert({
    where: { businessId_platform_externalId: { businessId: page.businessId, platform, externalId } },
    create: { businessId: page.businessId, pageId: page.id, platform, externalId, name, username, profilePic },
    update: {},
    include: { page: true },
  });
}

/** Contact came from a Click-to-Message ad → remember the ad and tag "Зараас". */
async function attributeAd(contactId: string, businessId: string, adId: string) {
  const contact = await prisma.contact.findUniqueOrThrow({ where: { id: contactId } });
  if (!contact.adId) await prisma.contact.update({ where: { id: contactId }, data: { adId } });
  const tag = await prisma.tag.upsert({
    where: { businessId_name: { businessId, name: AD_TAG } },
    create: { businessId, name: AD_TAG, color: "#ea580c" },
    update: {},
  });
  await applyTag(contactId, tag.id, "AD");
}

const AD_TAG = "Зараас";

async function handleMessaging(page: ConnectedPage, platform: Platform, ev: Any) {
  const ownId = platform === "FACEBOOK" ? page.fbPageId : page.igAccountId;

  // Echo of a message sent by the page
  if (ev.message?.is_echo) {
    // Sent by our app → already stored. Sent by a human in Meta Business Suite / IG app → pause the bot.
    const appId = String(ev.message.app_id ?? "");
    if (appId && (appId === config.meta.appId || appId === config.instagram.appId)) return;
    const mid: string | undefined = ev.message.mid;
    if (mid) {
      // Instagram echoes carry no app_id → give our own send a moment to record its mid, then compare
      await new Promise((r) => setTimeout(r, 2500));
      if (wasSentByUs(mid) || (await prisma.message.findUnique({ where: { mid } }))) return;
    }
    const recipient = ev.recipient?.id;
    if (!recipient || recipient === ownId) return;
    const contact = await upsertContact(page, platform, recipient);
    const msg = await prisma.message.create({
      data: {
        businessId: page.businessId,
        contactId: contact.id,
        direction: "OUT",
        sender: "AGENT",
        text: ev.message.text ?? "",
        mid: ev.message.mid ?? null,
      },
    });
    await prisma.contact.update({
      where: { id: contact.id },
      data: {
        botPausedUntil: new Date(Date.now() + HUMAN_TAKEOVER_MS),
        lastMessageAt: msg.createdAt,
        lastMessageText: msg.text.slice(0, 200),
      },
    });
    emit(page.businessId, { type: "message", contactId: contact.id, message: msg });
    return;
  }

  const senderId: string | undefined = ev.sender?.id;
  if (!senderId || senderId === ownId) return;

  let text = "";
  let imageUrls: string[] = [];
  let mid: string | undefined;

  if (ev.message) {
    mid = ev.message.mid;
    text = ev.message.text ?? ev.message.quick_reply?.payload ?? "";
    imageUrls = (ev.message.attachments ?? [])
      .filter((a: Any) => a.type === "image" && a.payload?.url)
      .map((a: Any) => a.payload.url as string);
    const otherAttachments = (ev.message.attachments ?? []).filter((a: Any) => a.type !== "image");
    if (!text && otherAttachments.length) text = `(${otherAttachments.map((a: Any) => a.type).join(", ")} илгээсэн)`;
    if (ev.message.reply_to?.story) text = `[Story-д хариулсан] ${text}`;
  } else if (ev.postback) {
    mid = ev.postback.mid;
    text = ev.postback.title || ev.postback.payload || "";
  } else if (ev.referral) {
    // m.me link / ad click without a message → nothing to answer yet
    const c = await upsertContact(page, platform, senderId);
    if (ev.referral.source === "ADS" && ev.referral.ad_id) await attributeAd(c.id, page.businessId, String(ev.referral.ad_id));
    return;
  } else {
    return; // read / delivery / reaction events
  }

  if (!text && !imageUrls.length) return;
  const contact = await upsertContact(page, platform, senderId);
  const ref = ev.message?.referral ?? ev.postback?.referral;
  if (ref?.source === "ADS" && ref.ad_id) await attributeAd(contact.id, page.businessId, String(ref.ad_id));
  await receiveCustomerMessage({ contact, text, imageUrls, mid });
}

async function handleComment(
  page: ConnectedPage,
  platform: Platform,
  c: { commentId: string; postId?: string; fromId: string; fromName?: string; text: string },
) {
  const ownId = platform === "FACEBOOK" ? page.fbPageId : page.igAccountId;
  if (!c.fromId || c.fromId === ownId) return;

  const sub = await prisma.subscription.findUnique({ where: { businessId: page.businessId } });
  const features = PLANS[sub?.plan ?? "STARTER"].features;

  // COMMENT tagging. Note: on Facebook the commenter id may differ from their Messenger PSID;
  // the private reply below opens the DM thread and the PSID contact is created when they answer.
  const contact = await upsertContact(page, platform, c.fromId, c.fromName);
  await applyCommentRules({ businessId: page.businessId, contactId: contact.id, postId: c.postId, text: c.text });

  if (!page.commentAutoReply || !features.commentAutoReply || !channelEnabled(page, platform)) return;
  const token = decrypt(page.accessToken);
  const api = graph.apiFor(page.kind);
  try {
    if (page.commentReplyText) {
      if (platform === "FACEBOOK") await graph.replyToFbComment(token, c.commentId, page.commentReplyText);
      else await graph.replyToIgComment(api, token, c.commentId, page.commentReplyText);
    }
    if (page.commentDmText) {
      await graph.sendPrivateReply(api, token, c.commentId, page.commentDmText, graph.msgNode(page));
      await prisma.message.create({
        data: {
          businessId: page.businessId,
          contactId: contact.id,
          direction: "OUT",
          sender: "BOT",
          text: page.commentDmText,
        },
      });
    }
  } catch (err) {
    console.error("[comment] auto-reply failed", err);
  }
}

export async function processWebhook(body: Any) {
  if (body?.object === "page") {
    for (const entry of body.entry ?? []) {
      const page = await prisma.connectedPage.findUnique({ where: { fbPageId: String(entry.id) } });
      if (!page) continue;
      for (const ev of entry.messaging ?? []) await handleMessaging(page, "FACEBOOK", ev).catch(logErr);
      for (const ch of entry.changes ?? []) {
        const v = ch.value ?? {};
        if (ch.field === "feed" && v.item === "comment" && v.verb === "add" && v.from?.id) {
          await handleComment(page, "FACEBOOK", {
            commentId: v.comment_id,
            postId: v.post_id,
            fromId: String(v.from.id),
            fromName: v.from.name,
            text: v.message ?? "",
          }).catch(logErr);
        }
      }
    }
  } else if (body?.object === "instagram") {
    for (const entry of body.entry ?? []) {
      const page = await prisma.connectedPage.findUnique({ where: { igAccountId: String(entry.id) } });
      if (!page) continue;
      for (const ev of entry.messaging ?? []) await handleMessaging(page, "INSTAGRAM", ev).catch(logErr);
      for (const ch of entry.changes ?? []) {
        const v = ch.value ?? {};
        if (ch.field === "comments" && v.from?.id) {
          await handleComment(page, "INSTAGRAM", {
            commentId: v.id,
            postId: v.media?.id,
            fromId: String(v.from.id),
            fromName: v.from.username,
            text: v.text ?? "",
          }).catch(logErr);
        }
      }
    }
  }
}

function logErr(err: unknown) {
  console.error("[webhook]", err);
}
