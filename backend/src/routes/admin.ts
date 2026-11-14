/**
 * Platform admin API (/api/admin) — for the people who run the SaaS itself, not for business owners.
 * Customers, subscriptions, revenue, manual payments and suspensions.
 */
import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../config.ts";
import { badRequest, HttpError, notFound, param, parse } from "../lib/http.ts";
import { prisma, type Prisma } from "../lib/prisma.ts";
import { requireAdmin, signAdminToken } from "../middleware/adminAuth.ts";
import { PLANS } from "../plans.ts";
import { subscriptionSummary } from "../services/account.ts";
import { applyPaidPeriod, isSubscriptionActive } from "../services/billing/subscription.ts";

export const adminRouter = Router();

const DAY = 86_400_000;
const PAGE_SIZE = 25;
const loginLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 10, standardHeaders: true, legacyHeaders: false });
const PlanSchema = z.enum(["STARTER", "BUSINESS", "PRO"]);

/** Start of the current calendar month in Ulaanbaatar time (UTC+8, no DST) */
function ubMonthStart(offsetMonths = 0, now = new Date()): Date {
  const ub = new Date(now.getTime() + 8 * 3_600_000);
  return new Date(Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth() + offsetMonths, 1) - 8 * 3_600_000);
}

const ubDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit" });

/** Fill missing days so charts get a continuous series */
function fillDays<T extends Record<string, number>>(days: number, rows: Map<string, Partial<T>>, empty: T): Array<T & { day: string }> {
  const out: Array<T & { day: string }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = ubDay.format(new Date(Date.now() - i * DAY));
    out.push({ ...empty, ...rows.get(day), day });
  }
  return out;
}

// ───────── Auth ─────────

adminRouter.post("/login", loginLimiter, async (req, res) => {
  const body = parse(z.object({ email: z.string().transform((e) => e.toLowerCase().trim()), password: z.string() }), req.body);
  const admin = await prisma.admin.findUnique({ where: { email: body.email } });
  if (!admin || !(await bcrypt.compare(body.password, admin.passwordHash))) {
    throw new HttpError(401, "Имэйл эсвэл нууц үг буруу", "INVALID_CREDENTIALS");
  }
  await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
  res.json({ token: signAdminToken(admin.id) });
});

adminRouter.use(requireAdmin);

adminRouter.get("/me", async (req, res) => {
  const admin = await prisma.admin.findUniqueOrThrow({
    where: { id: req.adminId },
    select: { id: true, email: true, name: true, lastLoginAt: true },
  });
  res.json(admin);
});

adminRouter.post("/password", async (req, res) => {
  const body = parse(z.object({ current: z.string(), next: z.string().min(10, "Хамгийн багадаа 10 тэмдэгт") }), req.body);
  const admin = await prisma.admin.findUniqueOrThrow({ where: { id: req.adminId } });
  if (!(await bcrypt.compare(body.current, admin.passwordHash))) throw badRequest("Одоогийн нууц үг буруу", "INVALID_CREDENTIALS");
  await prisma.admin.update({ where: { id: admin.id }, data: { passwordHash: await bcrypt.hash(body.next, 12) } });
  res.json({ ok: true });
});

// ───────── Overview ─────────

adminRouter.get("/overview", async (_req, res) => {
  const now = new Date();
  const monthStart = ubMonthStart(0, now);
  const lastMonthStart = ubMonthStart(-1, now);
  const from30 = new Date(now.getTime() - 30 * DAY);

  const [
    businessesTotal,
    new7,
    new30,
    suspended,
    subs,
    revenueMonth,
    revenueLastMonth,
    revenueTotal,
    botRepliesMonth,
    channels,
    signupsDaily,
    revenueDaily,
    messagesDaily,
    recentSignups,
    recentPayments,
  ] = await Promise.all([
    prisma.business.count(),
    prisma.business.count({ where: { createdAt: { gte: new Date(now.getTime() - 7 * DAY) } } }),
    prisma.business.count({ where: { createdAt: { gte: from30 } } }),
    prisma.business.count({ where: { suspendedAt: { not: null } } }),
    prisma.subscription.findMany({
      select: {
        plan: true,
        status: true,
        currentPeriodEnd: true,
        autoRenew: true,
        businessId: true,
        business: { select: { name: true, suspendedAt: true, owner: { select: { name: true, phone: true } } } },
      },
    }),
    prisma.payment.aggregate({ where: { status: "PAID", paidAt: { gte: monthStart } }, _sum: { amount: true }, _count: true }),
    prisma.payment.aggregate({ where: { status: "PAID", paidAt: { gte: lastMonthStart, lt: monthStart } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    prisma.message.count({ where: { sender: "BOT", createdAt: { gte: monthStart } } }),
    prisma.connectedPage.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day, COUNT(*) AS n
      FROM "Business" WHERE "createdAt" >= ${from30} GROUP BY 1`,
    prisma.$queryRaw<Array<{ day: string; amount: bigint }>>`
      SELECT to_char("paidAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day, SUM(amount) AS amount
      FROM "Payment" WHERE status = 'PAID' AND "paidAt" >= ${from30} GROUP BY 1`,
    prisma.$queryRaw<Array<{ day: string; inbound: bigint; bot: bigint }>>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
             COUNT(*) FILTER (WHERE sender = 'CUSTOMER') AS inbound,
             COUNT(*) FILTER (WHERE sender = 'BOT') AS bot
      FROM "Message" WHERE "createdAt" >= ${from30} GROUP BY 1`,
    prisma.business.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, name: true, businessType: true, createdAt: true, subscription: { select: { plan: true, status: true } }, owner: { select: { name: true } } },
    }),
    prisma.payment.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 8,
      select: { id: true, amount: true, plan: true, method: true, paidAt: true, isAutoCharge: true, business: { select: { id: true, name: true } } },
    }),
  ]);

  // Paying customers & MRR (suspended businesses don't count)
  const byPlan = { STARTER: 0, BUSINESS: 0, PRO: 0 };
  const byStatus: Record<string, number> = { ACTIVE: 0, PAST_DUE: 0, INCOMPLETE: 0, EXPIRED: 0, CANCELED: 0 };
  let mrr = 0;
  const expiring: Array<{ businessId: string; name: string; owner: string; phone: string | null; plan: string; endsAt: Date | null }> = [];
  for (const s of subs) {
    byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    if (s.business.suspendedAt || !isSubscriptionActive(s, now)) continue;
    byPlan[s.plan] += 1;
    mrr += PLANS[s.plan].price;
    if (s.currentPeriodEnd && s.currentPeriodEnd.getTime() - now.getTime() < 7 * DAY && !s.autoRenew) {
      expiring.push({
        businessId: s.businessId,
        name: s.business.name,
        owner: s.business.owner.name,
        phone: s.business.owner.phone ?? null,
        plan: s.plan,
        endsAt: s.currentPeriodEnd,
      });
    }
  }
  expiring.sort((a, b) => (a.endsAt?.getTime() ?? 0) - (b.endsAt?.getTime() ?? 0));
  const paying = byPlan.STARTER + byPlan.BUSINESS + byPlan.PRO;

  const series = fillDays(
    30,
    new Map<string, { signups: number; revenue: number; inbound: number; bot: number }>(),
    { signups: 0, revenue: 0, inbound: 0, bot: 0 },
  );
  const idx = new Map(series.map((d, i) => [d.day, i]));
  for (const r of signupsDaily) if (idx.has(r.day)) series[idx.get(r.day)!].signups = Number(r.n);
  for (const r of revenueDaily) if (idx.has(r.day)) series[idx.get(r.day)!].revenue = Number(r.amount);
  for (const r of messagesDaily) {
    if (!idx.has(r.day)) continue;
    series[idx.get(r.day)!].inbound = Number(r.inbound);
    series[idx.get(r.day)!].bot = Number(r.bot);
  }

  res.json({
    kpis: {
      businessesTotal,
      new7,
      new30,
      paying,
      suspended,
      mrr,
      arpu: paying ? Math.round(mrr / paying) : 0,
      revenueMonth: revenueMonth._sum.amount ?? 0,
      paymentsMonth: revenueMonth._count,
      revenueLastMonth: revenueLastMonth._sum.amount ?? 0,
      revenueTotal: revenueTotal._sum.amount ?? 0,
      botRepliesMonth,
      conversion: businessesTotal ? paying / businessesTotal : 0,
    },
    byPlan,
    byStatus,
    channels: Object.fromEntries(channels.map((c) => [c.kind, c._count._all])),
    series,
    expiring: expiring.slice(0, 10),
    recentSignups,
    recentPayments,
    system: {
      facebook: config.meta.enabled,
      instagram: config.instagram.enabled,
      httpsPublicUrl: config.publicApiUrl.startsWith("https://"),
      publicApiUrl: config.publicApiUrl,
      ai: Boolean(config.claude.apiKey),
      aiModel: config.claude.model,
      qpay: config.qpay.mock ? "mock" : "live",
      card: config.cardProvider,
    },
  });
});

// ───────── Businesses (customers) ─────────

const StatusFilter = z.enum(["all", "active", "expiring", "past_due", "unpaid", "expired", "suspended"]).catch("all");

function statusWhere(status: z.infer<typeof StatusFilter>, now: Date): Prisma.BusinessWhereInput {
  switch (status) {
    case "active":
      return { suspendedAt: null, subscription: { status: "ACTIVE", currentPeriodEnd: { gt: now } } };
    case "expiring":
      return { suspendedAt: null, subscription: { status: "ACTIVE", autoRenew: false, currentPeriodEnd: { gt: now, lt: new Date(now.getTime() + 7 * DAY) } } };
    case "past_due":
      return { suspendedAt: null, subscription: { status: "PAST_DUE" } };
    case "unpaid":
      return { suspendedAt: null, subscription: { status: "INCOMPLETE" } };
    case "expired":
      return {
        suspendedAt: null,
        OR: [{ subscription: { status: { in: ["EXPIRED", "CANCELED"] } } }, { subscription: { status: "ACTIVE", currentPeriodEnd: { lte: now } } }],
      };
    case "suspended":
      return { suspendedAt: { not: null } };
    default:
      return {};
  }
}

adminRouter.get("/businesses", async (req, res) => {
  const now = new Date();
  const q = String(req.query.q ?? "").trim();
  const status = StatusFilter.parse(req.query.status);
  const plan = PlanSchema.optional().catch(undefined).parse(req.query.plan || undefined);
  const page = Math.max(1, Number(req.query.page) || 1);

  const where: Prisma.BusinessWhereInput = {
    AND: [
      statusWhere(status, now),
      plan ? { subscription: { plan } } : {},
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { owner: { name: { contains: q, mode: "insensitive" } } },
              { owner: { email: { contains: q, mode: "insensitive" } } },
              { owner: { phone: { contains: q } } },
              { pages: { some: { OR: [{ name: { contains: q, mode: "insensitive" } }, { igUsername: { contains: q, mode: "insensitive" } }] } } },
            ],
          }
        : {},
    ],
  };

  const [total, rows] = await Promise.all([
    prisma.business.count({ where }),
    prisma.business.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        businessType: true,
        createdAt: true,
        suspendedAt: true,
        owner: { select: { name: true, email: true, phone: true, fbUserId: true, igUserId: true } },
        subscription: { select: { plan: true, status: true, currentPeriodEnd: true, autoRenew: true } },
        pages: { select: { kind: true, name: true, igUsername: true } },
        _count: { select: { contacts: true } },
      },
    }),
  ]);

  const ids = rows.map((r) => r.id);
  const monthStart = ubMonthStart(0, now);
  const [ai, paid, last] = ids.length
    ? await Promise.all([
        prisma.message.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, sender: "BOT", createdAt: { gte: monthStart } }, _count: { _all: true } }),
        prisma.payment.groupBy({ by: ["businessId"], where: { businessId: { in: ids }, status: "PAID" }, _sum: { amount: true } }),
        prisma.message.groupBy({ by: ["businessId"], where: { businessId: { in: ids } }, _max: { createdAt: true } }),
      ])
    : [[], [], []];
  const aiMap = new Map(ai.map((x) => [x.businessId, x._count._all]));
  const paidMap = new Map(paid.map((x) => [x.businessId, x._sum.amount ?? 0]));
  const lastMap = new Map(last.map((x) => [x.businessId, x._max.createdAt]));

  res.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    items: rows.map((r) => ({
      ...r,
      active: !r.suspendedAt && isSubscriptionActive(r.subscription, now),
      aiRepliesMonth: aiMap.get(r.id) ?? 0,
      paidTotal: paidMap.get(r.id) ?? 0,
      lastActivityAt: lastMap.get(r.id) ?? null,
    })),
  });
});

adminRouter.get("/businesses/:id", async (req, res) => {
  const id = param(req, "id");
  const b = await prisma.business.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      businessType: true,
      createdAt: true,
      suspendedAt: true,
      suspendReason: true,
      adminNote: true,
      widgetSettings: true,
      owner: { select: { id: true, name: true, email: true, phone: true, fbUserId: true, igUserId: true, locale: true, createdAt: true, avatarUrl: true } },
      // never expose access tokens
      pages: {
        select: { id: true, kind: true, name: true, igUsername: true, fbEnabled: true, igEnabled: true, commentAutoReply: true, lastSyncedAt: true, tokenExpiresAt: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { id: true, plan: true, amount: true, method: true, status: true, isAutoCharge: true, failureReason: true, note: true, paidAt: true, createdAt: true, paymentMethod: { select: { brand: true, last4: true } } },
      },
      _count: { select: { contacts: true, messages: true, leads: true, knowledge: true, broadcasts: true, tags: true } },
    },
  });
  if (!b) throw notFound("Бизнес олдсонгүй");

  const from30 = new Date(Date.now() - 30 * DAY);
  const [summary, daily, paidTotal, lastMessage] = await Promise.all([
    subscriptionSummary(id),
    prisma.$queryRaw<Array<{ day: string; inbound: bigint; bot: bigint }>>`
      SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
             COUNT(*) FILTER (WHERE sender = 'CUSTOMER') AS inbound,
             COUNT(*) FILTER (WHERE sender = 'BOT') AS bot
      FROM "Message" WHERE "businessId" = ${id} AND "createdAt" >= ${from30} GROUP BY 1`,
    prisma.payment.aggregate({ where: { businessId: id, status: "PAID" }, _sum: { amount: true } }),
    prisma.message.findFirst({ where: { businessId: id }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
  ]);
  const rows = new Map(daily.map((d) => [d.day, { inbound: Number(d.inbound), bot: Number(d.bot) }]));
  const widget = (b.widgetSettings ?? {}) as { enabled?: boolean };

  res.json({
    ...b,
    widgetSettings: undefined,
    widgetEnabled: Boolean(widget.enabled),
    subscription: summary,
    paidTotal: paidTotal._sum.amount ?? 0,
    lastActivityAt: lastMessage?.createdAt ?? null,
    series: fillDays(30, rows, { inbound: 0, bot: 0 }),
  });
});

/** Suspend / unsuspend, internal note */
adminRouter.patch("/businesses/:id", async (req, res) => {
  const id = param(req, "id");
  const body = parse(
    z.object({
      suspended: z.boolean().optional(),
      suspendReason: z.string().trim().max(300).nullable().optional(),
      adminNote: z.string().trim().max(5000).nullable().optional(),
    }),
    req.body,
  );
  const b = await prisma.business.findUnique({ where: { id }, select: { id: true, suspendedAt: true } });
  if (!b) throw notFound("Бизнес олдсонгүй");
  const data: Prisma.BusinessUpdateInput = {};
  if (body.adminNote !== undefined) data.adminNote = body.adminNote || null;
  if (body.suspended === true) {
    data.suspendedAt = b.suspendedAt ?? new Date();
    data.suspendReason = body.suspendReason || null;
  } else if (body.suspended === false) {
    data.suspendedAt = null;
    data.suspendReason = null;
  }
  await prisma.business.update({ where: { id }, data });
  res.json({ ok: true });
});

/** Change plan / status / period end directly */
adminRouter.patch("/businesses/:id/subscription", async (req, res) => {
  const id = param(req, "id");
  const body = parse(
    z.object({
      plan: PlanSchema.optional(),
      status: z.enum(["ACTIVE", "PAST_DUE", "INCOMPLETE", "EXPIRED", "CANCELED"]).optional(),
      currentPeriodEnd: z.coerce.date().nullable().optional(),
      autoRenew: z.boolean().optional(),
    }),
    req.body,
  );
  const sub = await prisma.subscription.findUnique({ where: { businessId: id } });
  if (!sub) throw notFound("Захиалга олдсонгүй");
  const data: Prisma.SubscriptionUpdateInput = {};
  if (body.plan) {
    data.plan = body.plan;
    data.pendingPlan = null;
  }
  if (body.autoRenew !== undefined) data.autoRenew = body.autoRenew;
  if (body.currentPeriodEnd !== undefined) data.currentPeriodEnd = body.currentPeriodEnd;
  if (body.status) {
    data.status = body.status;
    if (body.status === "ACTIVE") {
      const end = body.currentPeriodEnd ?? sub.currentPeriodEnd;
      if (!end || end <= new Date()) throw badRequest("Идэвхжүүлэхийн тулд дуусах огноо ирээдүйд байх ёстой — эсвэл «Хугацаа сунгах»-ыг ашиглана уу");
      data.failedAttempts = 0;
      data.nextRetryAt = null;
      if (!sub.currentPeriodStart) data.currentPeriodStart = new Date();
    }
  }
  await prisma.subscription.update({ where: { businessId: id }, data });
  res.json({ ok: true });
});

/** Give free days (support / compensation) — activates the subscription */
adminRouter.post("/businesses/:id/extend", async (req, res) => {
  const id = param(req, "id");
  const body = parse(z.object({ days: z.number().int().min(1).max(366) }), req.body);
  const sub = await prisma.subscription.findUnique({ where: { businessId: id } });
  if (!sub) throw notFound("Захиалга олдсонгүй");
  const now = new Date();
  const base = sub.currentPeriodEnd && sub.currentPeriodEnd > now && ["ACTIVE", "PAST_DUE"].includes(sub.status) ? sub.currentPeriodEnd : now;
  await prisma.subscription.update({
    where: { businessId: id },
    data: {
      status: "ACTIVE",
      currentPeriodStart: base === now ? now : sub.currentPeriodStart ?? now,
      currentPeriodEnd: new Date(base.getTime() + body.days * DAY),
      failedAttempts: 0,
      nextRetryAt: null,
    },
  });
  res.json({ ok: true });
});

/** Record a payment received outside the system (bank transfer, cash) and activate the plan */
adminRouter.post("/businesses/:id/payments", async (req, res) => {
  const id = param(req, "id");
  const body = parse(
    z.object({
      plan: PlanSchema,
      months: z.number().int().min(1).max(12),
      amount: z.number().int().min(0).max(100_000_000).optional(),
      note: z.string().trim().max(300).optional(),
    }),
    req.body,
  );
  const exists = await prisma.business.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw notFound("Бизнес олдсонгүй");
  const amount = body.amount ?? PLANS[body.plan].price * body.months;
  const now = new Date();
  await prisma.payment.create({
    data: {
      businessId: id,
      plan: body.plan,
      amount,
      method: "MANUAL",
      status: "PAID",
      paidAt: now,
      note: [body.months > 1 ? `${body.months} сар` : null, body.note || null].filter(Boolean).join(" · ") || null,
    },
  });
  for (let i = 0; i < body.months; i++) await applyPaidPeriod(id, body.plan);
  res.json({ ok: true });
});

// ───────── Payments ─────────

adminRouter.get("/payments", async (req, res) => {
  const status = z.enum(["PENDING", "PAID", "FAILED", "CANCELED"]).optional().catch(undefined).parse(req.query.status || undefined);
  const method = z.enum(["QPAY", "CARD", "MANUAL"]).optional().catch(undefined).parse(req.query.method || undefined);
  const q = String(req.query.q ?? "").trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const where: Prisma.PaymentWhereInput = {
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(q ? { business: { name: { contains: q, mode: "insensitive" } } } : {}),
  };
  const [total, items, sums] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        plan: true,
        amount: true,
        method: true,
        status: true,
        isAutoCharge: true,
        failureReason: true,
        note: true,
        paidAt: true,
        createdAt: true,
        paymentMethod: { select: { brand: true, last4: true } },
        business: { select: { id: true, name: true } },
      },
    }),
    prisma.payment.groupBy({ by: ["method"], where: { ...where, status: "PAID" }, _sum: { amount: true }, _count: { _all: true } }),
  ]);
  res.json({
    total,
    page,
    pageSize: PAGE_SIZE,
    items,
    paidByMethod: Object.fromEntries(sums.map((s) => [s.method, { amount: s._sum.amount ?? 0, count: s._count._all }])),
  });
});
