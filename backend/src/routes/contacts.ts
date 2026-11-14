import { Router } from "express";
import { z } from "zod";
import { badRequest, notFound, param, parse } from "../lib/http.ts";
import { prisma, type Prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { WINDOW_MS, sendToContact } from "../services/chat/send.ts";
import { emit } from "../services/realtime.ts";
import { applyTag, removeTag } from "../services/tagging.ts";

export const contactsRouter = Router();
contactsRouter.use(requireAuth);

const HUMAN_AGENT_WINDOW_MS = 7 * 24 * 3600 * 1000;

const contactInclude = {
  tags: { include: { tag: true }, orderBy: { createdAt: "asc" } },
  page: { select: { id: true, name: true, igUsername: true } },
} satisfies Prisma.ContactInclude;

async function own(req: Parameters<typeof bid>[0]) {
  const c = await prisma.contact.findFirst({
    where: { id: param(req, "id"), businessId: bid(req) },
    include: { ...contactInclude, page: true },
  });
  if (!c) throw notFound("Contact not found");
  return c;
}

function serialize<T extends { page?: unknown; tags: Array<{ tag: unknown; source: string }> }>(c: T) {
  const { page, ...rest } = c as T & { page?: { id: string; name: string; igUsername: string | null } | null };
  return {
    ...rest,
    page: page ? { id: page.id, name: page.name, igUsername: page.igUsername } : null,
    tags: c.tags.map((t) => ({ ...(t.tag as object), source: t.source })),
  };
}

contactsRouter.get("/", async (req, res) => {
  const q = parse(
    z.object({
      search: z.string().optional(),
      tagId: z.string().optional(),
      platform: z.enum(["FACEBOOK", "INSTAGRAM", "WEB"]).optional(),
      needsHuman: z.enum(["true", "false"]).optional(),
      ageMin: z.coerce.number().int().min(0).max(120).optional(),
      ageMax: z.coerce.number().int().min(0).max(120).optional(),
      gender: z.enum(["MALE", "FEMALE"]).optional(),
      city: z.string().max(60).optional(),
      district: z.string().max(60).optional(),
      take: z.coerce.number().int().min(1).max(200).default(50),
      skip: z.coerce.number().int().min(0).default(0),
    }),
    req.query,
  );
  const where: Prisma.ContactWhereInput = {
    businessId: bid(req),
    NOT: { externalId: { startsWith: "playground:" } },
    ...(q.platform ? { platform: q.platform } : {}),
    ...(q.tagId ? { tags: { some: { tagId: q.tagId } } } : {}),
    ...(q.needsHuman === "true" ? { needsHuman: true } : {}),
    ...(q.gender ? { gender: q.gender } : {}),
    ...(q.city ? { city: q.city } : {}),
    ...(q.district ? { district: q.district } : {}),
    ...(q.ageMin != null || q.ageMax != null
      ? {
          birthYear: {
            ...(q.ageMin != null ? { lte: new Date().getFullYear() - q.ageMin } : {}),
            ...(q.ageMax != null ? { gte: new Date().getFullYear() - q.ageMax } : {}),
          },
        }
      : {}),
    ...(q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: "insensitive" } },
            { phone: { contains: q.search } },
            { username: { contains: q.search, mode: "insensitive" } },
            { lastMessageText: { contains: q.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: contactInclude,
      orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }],
      take: q.take,
      skip: q.skip,
    }),
    prisma.contact.count({ where }),
  ]);
  res.json({ items: items.map(serialize), total });
});

contactsRouter.get("/:id", async (req, res) => {
  const c = await own(req);
  const leads = await prisma.lead.findMany({ where: { contactId: c.id }, orderBy: { createdAt: "desc" } });
  res.json({ ...serialize(c), leads });
});

contactsRouter.patch("/:id", async (req, res) => {
  const c = await own(req);
  const body = parse(
    z.object({
      name: z.string().max(120).optional(),
      phone: z.string().max(40).nullable().optional(),
      email: z.string().max(200).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
      needsHuman: z.boolean().optional(),
      age: z.number().int().min(1).max(120).nullable().optional(),
      gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
      city: z.string().max(60).nullable().optional(),
      district: z.string().max(60).nullable().optional(),
    }),
    req.body,
  );
  const { age, ...rest } = body;
  await prisma.contact.update({
    where: { id: c.id },
    data: {
      ...rest,
      ...(age !== undefined ? { birthYear: age === null ? null : new Date().getFullYear() - age } : {}),
      ...(body.district ? { city: body.city ?? "Улаанбаатар" } : {}),
    },
  });
  res.json({ ok: true });
});

contactsRouter.get("/:id/messages", async (req, res) => {
  const c = await own(req);
  const before = typeof req.query.before === "string" ? new Date(req.query.before) : undefined;
  const msgs = await prisma.message.findMany({
    where: { contactId: c.id, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  res.json(msgs.reverse());
});

contactsRouter.post("/:id/messages", async (req, res) => {
  const c = await own(req);
  const { text, pauseBot } = parse(
    z.object({ text: z.string().trim().min(1).max(2000), pauseBot: z.boolean().default(true) }),
    req.body,
  );
  const since = c.lastInboundAt ? Date.now() - c.lastInboundAt.getTime() : Infinity;
  if (c.platform !== "WEB" && since > HUMAN_AGENT_WINDOW_MS) {
    throw badRequest("Хэрэглэгч 7 хоногоос дээш бичээгүй тул Meta-ийн дүрмээр мессеж илгээх боломжгүй", "WINDOW_CLOSED");
  }
  // Inside 24h → normal reply. 24h–7d → HUMAN_AGENT tag (requires the Human Agent permission in Meta).
  const tag = c.platform !== "WEB" && since > WINDOW_MS ? "HUMAN_AGENT" : null;
  const msg = await sendToContact({ contact: c, text, sender: "AGENT", tag }).catch((err) => {
    throw badRequest(`Илгээж чадсангүй: ${err.message}`, "SEND_FAILED");
  });
  if (pauseBot) {
    await prisma.contact.update({
      where: { id: c.id },
      data: { botPausedUntil: new Date(Date.now() + 12 * 3600 * 1000), unread: 0 },
    });
  }
  res.status(201).json(msg);
});

contactsRouter.post("/:id/read", async (req, res) => {
  const c = await own(req);
  await prisma.contact.update({ where: { id: c.id }, data: { unread: 0 } });
  res.json({ ok: true });
});

/** Pause (human takeover) or resume the bot for this conversation */
contactsRouter.post("/:id/bot", async (req, res) => {
  const c = await own(req);
  const { paused, hours } = parse(z.object({ paused: z.boolean(), hours: z.number().min(1).max(24 * 30).default(24) }), req.body);
  await prisma.contact.update({
    where: { id: c.id },
    data: paused
      ? { botPausedUntil: new Date(Date.now() + hours * 3600 * 1000) }
      : { botPausedUntil: null, needsHuman: false },
  });
  emit(c.businessId, { type: "contact", contactId: c.id });
  res.json({ ok: true });
});

contactsRouter.post("/:id/tags", async (req, res) => {
  const c = await own(req);
  const { tagId } = parse(z.object({ tagId: z.string() }), req.body);
  const tag = await prisma.tag.findFirst({ where: { id: tagId, businessId: c.businessId } });
  if (!tag) throw notFound("Tag not found");
  await applyTag(c.id, tag.id, "MANUAL");
  res.json({ ok: true });
});

contactsRouter.delete("/:id/tags/:tagId", async (req, res) => {
  const c = await own(req);
  await removeTag(c.id, param(req, "tagId"));
  res.json({ ok: true });
});

contactsRouter.post("/bulk-tag", async (req, res) => {
  const businessId = bid(req);
  const body = parse(z.object({ contactIds: z.array(z.string()).min(1).max(1000), tagId: z.string() }), req.body);
  const tag = await prisma.tag.findFirst({ where: { id: body.tagId, businessId } });
  if (!tag) throw notFound("Tag not found");
  const contacts = await prisma.contact.findMany({ where: { id: { in: body.contactIds }, businessId }, select: { id: true } });
  for (const c of contacts) await applyTag(c.id, tag.id, "MANUAL");
  res.json({ ok: true, tagged: contacts.length });
});
