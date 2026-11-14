import { Router } from "express";
import { z } from "zod";
import { config } from "../config.ts";
import { badRequest, notFound, param, parse } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { PLANS } from "../plans.ts";
import { subscriptionSummary } from "../services/account.ts";
import { cardProvider } from "../services/billing/cardProviders/index.ts";
import { chargeSavedCard, settleQPayPayment } from "../services/billing/charge.ts";
import * as qpay from "../services/billing/qpay.ts";

export const billingPublicRouter = Router();

/** QPay calls this when an invoice is paid. We re-verify with QPay before settling. */
billingPublicRouter.get("/qpay/callback", async (req, res) => {
  const paymentId = String(req.query.paymentId ?? "");
  const p = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (p?.status === "PENDING" && p.qpayInvoiceId && (await qpay.isInvoicePaid(p.qpayInvoiceId).catch(() => false))) {
    await settleQPayPayment(p.id);
  }
  res.status(200).send("SUCCESS");
});

export const billingRouter = Router();
billingRouter.use(requireAuth);

const PlanSchema = z.enum(["STARTER", "BUSINESS", "PRO"]);

billingRouter.get("/", async (req, res) => {
  const businessId = bid(req);
  const [summary, cards, payments] = await Promise.all([
    subscriptionSummary(businessId),
    prisma.paymentMethod.findMany({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { id: true, brand: true, last4: true, expMonth: true, expYear: true, isDefault: true, provider: true },
    }),
    prisma.payment.findMany({
      where: { businessId, status: { not: "CANCELED" } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true, plan: true, amount: true, currency: true, method: true, status: true,
        isAutoCharge: true, failureReason: true, paidAt: true, createdAt: true,
        paymentMethod: { select: { brand: true, last4: true } },
      },
    }),
  ]);
  res.json({
    subscription: summary,
    cards,
    payments,
    qpayMock: config.qpay.mock,
    cardProvider: config.cardProvider,
    paymentOptions: { qpay: config.qpayAvailable, card: config.cardAvailable, manualNote: config.manualPaymentNote },
  });
});

const manualOnly = () => badRequest("Онлайн төлбөр одоогоор идэвхгүй байна — дансаар шилжүүлээд бидэнтэй холбогдоно уу", "PAYMENTS_MANUAL");

// ───────── QPay ─────────

billingRouter.post("/qpay", async (req, res) => {
  const businessId = bid(req);
  const { plan } = parse(z.object({ plan: PlanSchema }), req.body);
  if (!config.qpayAvailable) throw manualOnly();
  const amount = PLANS[plan].price;

  // Re-use an open invoice for the same plan instead of creating duplicates
  const open = await prisma.payment.findFirst({
    where: { businessId, plan, method: "QPAY", status: "PENDING", createdAt: { gt: new Date(Date.now() - 30 * 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (open?.qrImage) {
    return res.json(serializeQPay(open));
  }

  const payment = await prisma.payment.create({ data: { businessId, plan, amount, method: "QPAY", status: "PENDING" } });
  const invoice = await qpay.createInvoice({
    paymentId: payment.id,
    amount,
    description: `Chatbot ${PLANS[plan].name.mn} багц — 1 сар`,
    receiverCode: businessId,
  });
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: { qpayInvoiceId: invoice.invoiceId, qrText: invoice.qrText, qrImage: invoice.qrImage, deeplinks: invoice.deeplinks },
  });
  res.json(serializeQPay(updated));
});

function serializeQPay(p: { id: string; plan: string; amount: number; status: string; qrImage: string | null; qrText: string | null; deeplinks: unknown }) {
  return {
    id: p.id,
    plan: p.plan,
    amount: p.amount,
    status: p.status,
    qrImage: p.qrImage,
    qrText: p.qrText,
    deeplinks: p.deeplinks ?? [],
    mock: config.qpay.mock,
  };
}

billingRouter.get("/payments/:id", async (req, res) => {
  const p = await prisma.payment.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!p) throw notFound();
  if (p.status === "PENDING" && p.method === "QPAY" && p.qpayInvoiceId && !config.qpay.mock) {
    if (await qpay.isInvoicePaid(p.qpayInvoiceId).catch(() => false)) await settleQPayPayment(p.id);
  }
  const fresh = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
  res.json({ id: fresh.id, status: fresh.status, plan: fresh.plan, amount: fresh.amount });
});

/** Mock mode only: pretend the customer paid in their bank app. */
billingRouter.post("/qpay/:id/simulate", async (req, res) => {
  if (!config.qpay.mock || !config.mockPaymentsAllowed) throw badRequest("Only available in QPay mock mode");
  const p = await prisma.payment.findFirst({ where: { id: param(req, "id"), businessId: bid(req), method: "QPAY" } });
  if (!p) throw notFound();
  await settleQPayPayment(p.id);
  res.json({ ok: true });
});

billingRouter.post("/qpay/:id/cancel", async (req, res) => {
  const p = await prisma.payment.findFirst({ where: { id: param(req, "id"), businessId: bid(req), status: "PENDING" } });
  if (p) {
    if (p.qpayInvoiceId) await qpay.cancelInvoice(p.qpayInvoiceId);
    await prisma.payment.update({ where: { id: p.id }, data: { status: "CANCELED" } });
  }
  res.json({ ok: true });
});

// ───────── Cards ─────────

billingRouter.post("/cards/setup", async (req, res) => {
  const businessId = bid(req);
  const body = parse(z.object({ payPlan: PlanSchema.optional(), autoRenew: z.boolean().default(true) }), req.body);
  if (!config.cardAvailable) throw manualOnly();
  const session = await prisma.cardSetupSession.create({
    data: {
      businessId,
      provider: cardProvider().name,
      payPlan: body.payPlan,
      autoRenew: body.autoRenew,
      returnUrl: `${config.appUrl}/dashboard/billing`,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });
  const { redirectUrl } = await cardProvider().createSetupSession({
    sessionId: session.id,
    amount: body.payPlan ? PLANS[body.payPlan].price : undefined,
    description: "Chatbot subscription card",
  });
  res.json({ redirectUrl });
});

billingRouter.post("/cards/:id/default", async (req, res) => {
  const businessId = bid(req);
  const pm = await prisma.paymentMethod.findFirst({ where: { id: param(req, "id"), businessId } });
  if (!pm) throw notFound();
  await prisma.$transaction([
    prisma.paymentMethod.updateMany({ where: { businessId }, data: { isDefault: false } }),
    prisma.paymentMethod.update({ where: { id: pm.id }, data: { isDefault: true } }),
  ]);
  res.json({ ok: true });
});

billingRouter.delete("/cards/:id", async (req, res) => {
  const businessId = bid(req);
  const pm = await prisma.paymentMethod.findFirst({ where: { id: param(req, "id"), businessId } });
  if (!pm) throw notFound();
  await prisma.paymentMethod.delete({ where: { id: pm.id } });
  const left = await prisma.paymentMethod.count({ where: { businessId } });
  if (!left) await prisma.subscription.updateMany({ where: { businessId }, data: { autoRenew: false } });
  res.json({ ok: true });
});

/** Pay now with a saved card */
billingRouter.post("/card-charge", async (req, res) => {
  const businessId = bid(req);
  const body = parse(z.object({ plan: PlanSchema, paymentMethodId: z.string().optional() }), req.body);
  if (!config.cardAvailable) throw manualOnly();
  const r = await chargeSavedCard({ businessId, plan: body.plan, paymentMethodId: body.paymentMethodId, isAutoCharge: false });
  if (!r.ok) throw badRequest(`Төлбөр амжилтгүй: ${r.reason}`, "CHARGE_FAILED");
  res.json({ ok: true, paymentId: r.payment.id });
});

billingRouter.patch("/subscription", async (req, res) => {
  const businessId = bid(req);
  const body = parse(z.object({ autoRenew: z.boolean().optional(), pendingPlan: PlanSchema.nullable().optional() }), req.body);
  if (body.autoRenew) {
    const cards = await prisma.paymentMethod.count({ where: { businessId } });
    if (!cards) throw badRequest("Автомат төлөлт идэвхжүүлэхийн тулд эхлээд карт холбоно уу", "NO_CARD");
  }
  await prisma.subscription.update({
    where: { businessId },
    data: {
      autoRenew: body.autoRenew,
      pendingPlan: body.pendingPlan,
      ...(body.autoRenew ? { failedAttempts: 0, nextRetryAt: null } : {}),
    },
  });
  res.json(await subscriptionSummary(businessId));
});
