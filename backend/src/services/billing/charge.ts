import { prisma, type PlanCode } from "../../lib/prisma.ts";
import { PLANS } from "../../plans.ts";
import { cardProvider } from "./cardProviders/index.ts";
import { applyPaidPeriod } from "./subscription.ts";

/** Charge a saved card for one month of `plan`. Records a Payment either way. */
export async function chargeSavedCard(args: {
  businessId: string;
  plan: PlanCode;
  paymentMethodId?: string;
  isAutoCharge: boolean;
}) {
  const pm = args.paymentMethodId
    ? await prisma.paymentMethod.findFirst({ where: { id: args.paymentMethodId, businessId: args.businessId } })
    : await prisma.paymentMethod.findFirst({
        where: { businessId: args.businessId },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      });
  if (!pm) return { ok: false as const, reason: "Хадгалсан карт алга", payment: null };

  const amount = PLANS[args.plan].price;
  const payment = await prisma.payment.create({
    data: {
      businessId: args.businessId,
      plan: args.plan,
      amount,
      method: "CARD",
      status: "PENDING",
      isAutoCharge: args.isAutoCharge,
      paymentMethodId: pm.id,
    },
  });

  const result = await cardProvider().charge({
    token: pm.token,
    amount,
    currency: "MNT",
    description: `Chatbot ${PLANS[args.plan].name.en} plan`,
    idempotencyKey: payment.id,
  });

  if (!result.ok) {
    const failed = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", failureReason: result.reason },
    });
    return { ok: false as const, reason: result.reason, payment: failed };
  }

  const paid = await prisma.payment.update({
    where: { id: payment.id },
    data: { status: "PAID", paidAt: new Date(), providerRef: result.ref },
  });
  await applyPaidPeriod(args.businessId, args.plan);
  return { ok: true as const, payment: paid };
}

/** Mark a QPay payment paid (idempotent) and activate the plan. */
export async function settleQPayPayment(paymentId: string): Promise<boolean> {
  const updated = await prisma.payment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (updated.count === 0) return false; // already settled / canceled
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  await applyPaidPeriod(p.businessId, p.plan);
  return true;
}
