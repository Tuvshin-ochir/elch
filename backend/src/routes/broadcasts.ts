import { Router } from "express";
import { z } from "zod";
import { badRequest, notFound, param, parse, planLimit } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { getPlanContext } from "../services/billing/subscription.ts";
import { WINDOW_MS } from "../services/chat/send.ts";
import { SegmentFiltersSchema, segmentWhere } from "../services/segment.ts";

export const broadcastsRouter = Router();
broadcastsRouter.use(requireAuth);

/** Meta message tags allowed for sending outside the 24h window (non-promotional content only). */
export const MESSAGE_TAGS = ["CONFIRMED_EVENT_UPDATE", "POST_PURCHASE_UPDATE", "ACCOUNT_UPDATE"] as const;

const BroadcastSchema = z.object({
  name: z.string().trim().min(1).max(120),
  message: z.string().trim().min(1).max(2000),
  type: z.enum(["ONE_TIME", "RECURRING", "TAG_TRIGGER", "INACTIVITY"]),
  tagIds: z.array(z.string()).max(50).default([]),
  filters: SegmentFiltersSchema.default({}),
  scheduledAt: z.coerce.date().nullable().optional(),
  recurrence: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).nullable().optional(),
  delayMinutes: z.number().int().min(1).max(60 * 24 * 30).nullable().optional(),
  messageTag: z.enum(MESSAGE_TAGS).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).default("ACTIVE"),
});

broadcastsRouter.get("/", async (req, res) => {
  res.json(await prisma.broadcast.findMany({ where: { businessId: bid(req) }, orderBy: { createdAt: "desc" } }));
});

/** Live audience size for the broadcast form (tags + segment filters). */
broadcastsRouter.post("/audience", async (req, res) => {
  const businessId = bid(req);
  const body = parse(z.object({ tagIds: z.array(z.string()).max(50).default([]), filters: SegmentFiltersSchema.default({}) }), req.body);
  const where = segmentWhere(businessId, body.tagIds, body.filters);
  const [total, inWindow, all] = await Promise.all([
    prisma.contact.count({ where }),
    prisma.contact.count({ where: { AND: [where, { lastInboundAt: { gt: new Date(Date.now() - WINDOW_MS) } }] } }),
    prisma.contact.count({ where: segmentWhere(businessId, body.tagIds, {}) }),
  ]);
  res.json({ total, inWindow, all });
});

broadcastsRouter.post("/", async (req, res) => {
  const businessId = bid(req);
  const body = parse(BroadcastSchema, req.body);
  const { plan } = await getPlanContext(businessId);

  if (body.type === "TAG_TRIGGER" || body.type === "INACTIVITY") {
    if (!plan.features.sequences) throw planLimit("Tag-аар өдөөгдөх болон идэвхгүй үеийн автомат мессеж Про багцад байна");
    if (!body.delayMinutes) throw badRequest("Хугацааны саатал (минут) оруулна уу");
    if (body.type === "TAG_TRIGGER" && !body.tagIds.length) throw badRequest("Ядаж нэг tag сонгоно уу");
  } else {
    if (!body.scheduledAt) throw badRequest("Илгээх огноо, цагийг сонгоно уу");
    if (body.type === "RECURRING" && !body.recurrence) throw badRequest("Давтамжийг сонгоно уу");
    if (plan.limits.broadcastsPerMonth !== null) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const used = await prisma.broadcast.count({
        where: { businessId, type: { in: ["ONE_TIME", "RECURRING"] }, createdAt: { gte: monthStart } },
      });
      if (used >= plan.limits.broadcastsPerMonth) {
        throw planLimit(`Энэ сард ${plan.limits.broadcastsPerMonth} broadcast үүсгэх эрх дууссан`);
      }
    }
  }
  if (body.tagIds.length) {
    const n = await prisma.tag.count({ where: { id: { in: body.tagIds }, businessId } });
    if (n !== body.tagIds.length) throw badRequest("Unknown tag");
  }

  const b = await prisma.broadcast.create({
    data: {
      businessId,
      ...body,
      nextRunAt: body.type === "ONE_TIME" || body.type === "RECURRING" ? body.scheduledAt : null,
    },
  });
  res.status(201).json(b);
});

broadcastsRouter.patch("/:id", async (req, res) => {
  const b = await prisma.broadcast.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!b) throw notFound();
  const body = parse(
    BroadcastSchema.pick({ name: true, message: true, status: true, tagIds: true, filters: true, messageTag: true, delayMinutes: true }).partial(),
    req.body,
  );
  if (b.status === "DONE" && body.status) throw badRequest("Дууссан broadcast-ийг өөрчлөх боломжгүй");
  res.json(await prisma.broadcast.update({ where: { id: b.id }, data: body }));
});

/** Run a one-time / recurring broadcast right now */
broadcastsRouter.post("/:id/run-now", async (req, res) => {
  const b = await prisma.broadcast.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!b) throw notFound();
  if (b.type !== "ONE_TIME" && b.type !== "RECURRING") throw badRequest("Only scheduled broadcasts can run now");
  if (b.status === "DONE") throw badRequest("Already sent");
  await prisma.broadcast.update({ where: { id: b.id }, data: { nextRunAt: new Date(), status: "ACTIVE" } });
  res.json({ ok: true });
});

broadcastsRouter.delete("/:id", async (req, res) => {
  const r = await prisma.broadcast.deleteMany({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!r.count) throw notFound();
  res.json({ ok: true });
});

broadcastsRouter.get("/:id/deliveries", async (req, res) => {
  const b = await prisma.broadcast.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!b) throw notFound();
  res.json(
    await prisma.broadcastDelivery.findMany({
      where: { broadcastId: b.id },
      include: { contact: { select: { id: true, name: true, platform: true, profilePic: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
});
