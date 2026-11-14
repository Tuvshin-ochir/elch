/**
 * Sandbox "bank hosted card page" API — only mounted when CARD_PROVIDER=mock.
 * A real bank replaces this entirely: the customer types the card on the bank's page and
 * the bank calls us back with a token.
 */
import { Router } from "express";
import { z } from "zod";
import { badRequest, notFound, param, parse } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { PLANS } from "../plans.ts";
import { mockTokenize } from "../services/billing/cardProviders/mock.ts";
import { chargeSavedCard } from "../services/billing/charge.ts";

export const mockBankRouter = Router();

function luhn(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function brandOf(num: string): string {
  if (/^4/.test(num)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(num)) return "Mastercard";
  if (/^62/.test(num)) return "UnionPay";
  if (/^9496/.test(num)) return "Local";
  return "Card";
}

async function loadSession(id: string) {
  const s = await prisma.cardSetupSession.findUnique({ where: { id }, include: { business: { select: { name: true } } } });
  if (!s) throw notFound("Session not found");
  return s;
}

mockBankRouter.get("/sessions/:id", async (req, res) => {
  const s = await loadSession(param(req, "id"));
  res.json({
    id: s.id,
    merchant: "Chatbot SaaS",
    customer: s.business.name,
    amount: s.payPlan ? PLANS[s.payPlan].price : 0,
    plan: s.payPlan,
    autoRenew: s.autoRenew,
    status: s.expiresAt < new Date() && s.status === "PENDING" ? "EXPIRED" : s.status,
  });
});

mockBankRouter.post("/sessions/:id/complete", async (req, res) => {
  const s = await loadSession(param(req, "id"));
  if (s.status !== "PENDING" || s.expiresAt < new Date()) throw badRequest("Session expired");
  const body = parse(
    z.object({
      cardNumber: z.string().transform((v) => v.replace(/\D/g, "")),
      expMonth: z.coerce.number().int().min(1).max(12),
      expYear: z.coerce.number().int().min(2000).max(2100),
      cvc: z.string().regex(/^\d{3,4}$/),
      holder: z.string().trim().min(2).max(80),
    }),
    req.body,
  );
  if (body.cardNumber.length < 13 || body.cardNumber.length > 19 || !luhn(body.cardNumber)) {
    throw badRequest("Картын дугаар буруу байна", "INVALID_CARD");
  }
  const expEnd = new Date(body.expYear, body.expMonth, 1);
  if (expEnd <= new Date()) throw badRequest("Картын хугацаа дууссан байна", "CARD_EXPIRED");

  const last4 = body.cardNumber.slice(-4);
  // Only token + display data are stored — never the PAN / CVC.
  await prisma.paymentMethod.updateMany({ where: { businessId: s.businessId }, data: { isDefault: false } });
  const pm = await prisma.paymentMethod.create({
    data: {
      businessId: s.businessId,
      provider: "mock",
      token: mockTokenize(last4),
      brand: brandOf(body.cardNumber),
      last4,
      expMonth: body.expMonth,
      expYear: body.expYear,
      isDefault: true,
    },
  });
  await prisma.cardSetupSession.update({ where: { id: s.id }, data: { status: "COMPLETED" } });
  if (s.autoRenew) {
    await prisma.subscription.updateMany({
      where: { businessId: s.businessId },
      data: { autoRenew: true, failedAttempts: 0, nextRetryAt: null },
    });
  }

  let result = "card_saved";
  if (s.payPlan) {
    const r = await chargeSavedCard({ businessId: s.businessId, plan: s.payPlan, paymentMethodId: pm.id, isAutoCharge: false });
    result = r.ok ? "paid" : "charge_failed";
  }
  res.json({ redirectUrl: `${s.returnUrl}?card=${result}` });
});

mockBankRouter.post("/sessions/:id/cancel", async (req, res) => {
  const s = await loadSession(param(req, "id"));
  if (s.status === "PENDING") await prisma.cardSetupSession.update({ where: { id: s.id }, data: { status: "FAILED" } });
  res.json({ redirectUrl: `${s.returnUrl}?card=canceled` });
});
