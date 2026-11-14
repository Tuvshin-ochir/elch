import { decrypt } from "../../lib/crypto.ts";
import { prisma, type Contact, type ConnectedPage, type MessageSender } from "../../lib/prisma.ts";
import * as graph from "../meta/graph.ts";
import { emit } from "../realtime.ts";

export const WINDOW_MS = 24 * 3600 * 1000;

/** Message ids we sent recently — lets the webhook tell our own echoes from a human replying in Meta's inbox. */
const recentMids = new Map<string, number>();
export function wasSentByUs(mid: string) {
  const now = Date.now();
  for (const [k, t] of recentMids) if (now - t > 10 * 60_000) recentMids.delete(k);
  return recentMids.has(mid);
}

/** Messenger limit is 2000 chars, Instagram 1000 */
function splitText(text: string, max: number): string[] {
  const parts: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(". ", max);
    if (cut < max * 0.5) cut = max;
    parts.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}

export function isPlayground(contact: Contact) {
  return contact.externalId.startsWith("playground:");
}

/** Messages to playground / website visitors are stored only — the widget polls for them. */
export function isLocalChannel(contact: Contact) {
  return isPlayground(contact) || contact.platform === "WEB";
}

export function withinWindow(contact: Contact, now = Date.now()) {
  return !!contact.lastInboundAt && now - contact.lastInboundAt.getTime() < WINDOW_MS;
}

/**
 * Send a text to a contact through Messenger / Instagram and store it.
 * `tag` = Meta message tag, required when outside the 24h customer-service window.
 */
export async function sendToContact(args: {
  contact: Contact & { page?: ConnectedPage | null };
  text: string;
  sender: MessageSender;
  tag?: string | null;
  messagingType?: graph.MessagingType;
}) {
  const { contact } = args;
  let mid: string | undefined;
  let error: string | undefined;

  if (!isLocalChannel(contact)) {
    const page = contact.page ?? (contact.pageId ? await prisma.connectedPage.findUnique({ where: { id: contact.pageId } }) : null);
    if (!page) throw new Error("Contact has no connected page");
    const token = decrypt(page.accessToken);
    const max = contact.platform === "INSTAGRAM" ? 1000 : 2000;
    try {
      for (const part of splitText(args.text, max)) {
        const r = await graph.sendText({
          api: graph.apiFor(page.kind),
          node: graph.msgNode(page),
          token,
          recipientId: contact.externalId,
          text: part,
          tag: args.tag ?? undefined,
          messagingType: args.messagingType,
        });
        if (r.message_id) recentMids.set(r.message_id, Date.now());
        mid ??= r.message_id;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  const msg = await prisma.message.create({
    data: {
      businessId: contact.businessId,
      contactId: contact.id,
      direction: "OUT",
      sender: args.sender,
      text: args.text,
      mid: mid ?? null,
      error: error ?? null,
    },
  });
  await prisma.contact.update({
    where: { id: contact.id },
    data: { lastMessageAt: msg.createdAt, lastMessageText: args.text.slice(0, 200) },
  });
  emit(contact.businessId, { type: "message", contactId: contact.id, message: msg });
  if (error) throw Object.assign(new Error(error), { messageId: msg.id });
  return msg;
}

export async function typing(contact: Contact & { page?: ConnectedPage | null }) {
  if (isLocalChannel(contact) || !contact.page) return;
  await graph.sendSenderAction(graph.apiFor(contact.page.kind), decrypt(contact.page.accessToken), contact.externalId, "typing_on", graph.msgNode(contact.page));
}
