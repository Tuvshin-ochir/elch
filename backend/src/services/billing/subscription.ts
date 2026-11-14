import { prisma, type Subscription, type PlanCode } from "../../lib/prisma.ts";
import { PLANS } from "../../plans.ts";

/** Days the bot keeps working after a failed auto-charge before expiring */
export const GRACE_DAYS = 3;
const DAY = 86_400_000;

export function addMonth(d: Date): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setMonth(r.getMonth() + 1);
  // Jan 31 + 1 month → Feb 28/29, not Mar 3
  if (r.getDate() < day) r.setDate(0);
  return r;
}

/** When does the current paid access end */
export function accessEndsAt(sub: Subscription): Date | null {
  return sub.currentPeriodEnd;
}

export function isSubscriptionActive(sub: Pick<Subscription, "status" | "currentPeriodEnd"> | null, now = new Date()): boolean {
  if (!sub) return false;
  switch (sub.status) {
    case "ACTIVE":
      return !!sub.currentPeriodEnd && sub.currentPeriodEnd > now;
    case "PAST_DUE":
      return !!sub.currentPeriodEnd && sub.currentPeriodEnd.getTime() + GRACE_DAYS * DAY > now.getTime();
    default:
      return false;
  }
}

/** Billing month window used for usage limits */
export function usageWindow(sub: Subscription | null, now = new Date()): { from: Date; to: Date } {
  if (sub?.currentPeriodStart && sub.currentPeriodEnd) {
    return { from: sub.currentPeriodStart, to: sub.currentPeriodEnd };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from, to: addMonth(from) };
}

export async function getPlanContext(businessId: string) {
  const [sub, business] = await Promise.all([
    prisma.subscription.findUnique({ where: { businessId } }),
    prisma.business.findUnique({ where: { id: businessId }, select: { suspendedAt: true } }),
  ]);
  const plan = PLANS[sub?.plan ?? "STARTER"];
  // A business suspended from /admin never gets bot replies, whatever its subscription says
  return { sub, plan, active: !business?.suspendedAt && isSubscriptionActive(sub) };
}

export async function aiRepliesUsed(businessId: string, sub: Subscription | null): Promise<number> {
  const { from, to } = usageWindow(sub);
  return prisma.message.count({
    where: { businessId, sender: "BOT", createdAt: { gte: from, lt: to } },
  });
}

/**
 * Apply a successful payment: start or extend the subscription by one month.
 * - Same plan & still active  → stack a month on top of the current period end
 * - New plan / expired / first payment → new period starting now
 */
export async function applyPaidPeriod(businessId: string, plan: PlanCode) {
  const sub = await prisma.subscription.findUnique({ where: { businessId } });
  const now = new Date();
  const stack =
    sub && sub.plan === plan && sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodEnd > now;
  const start = stack ? sub!.currentPeriodStart ?? now : now;
  const end = addMonth(stack ? sub!.currentPeriodEnd! : now);

  return prisma.subscription.upsert({
    where: { businessId },
    create: {
      businessId,
      plan,
      status: "ACTIVE",
      currentPeriodStart: start,
      currentPeriodEnd: end,
    },
    update: {
      plan,
      status: "ACTIVE",
      currentPeriodStart: stack ? start : now,
      currentPeriodEnd: end,
      pendingPlan: null,
      failedAttempts: 0,
      nextRetryAt: null,
    },
  });
}
