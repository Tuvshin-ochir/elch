import { DEFAULT_BOT_SETTINGS } from "../businessTypes.ts";
import { prisma, type PlanCode } from "../lib/prisma.ts";
import { PLANS } from "../plans.ts";
import { accessEndsAt, aiRepliesUsed, isSubscriptionActive } from "./billing/subscription.ts";

export async function subscriptionSummary(businessId: string) {
  const sub = await prisma.subscription.findUnique({ where: { businessId } });
  const plan = PLANS[sub?.plan ?? "STARTER"];
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [aiUsed, pages, files, broadcasts, card] = await Promise.all([
    aiRepliesUsed(businessId, sub),
    prisma.connectedPage.count({ where: { businessId } }),
    prisma.knowledgeSource.count({ where: { businessId, type: "FILE" } }),
    prisma.broadcast.count({
      where: { businessId, type: { in: ["ONE_TIME", "RECURRING"] }, createdAt: { gte: monthStart } },
    }),
    prisma.paymentMethod.findFirst({
      where: { businessId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { id: true, brand: true, last4: true, expMonth: true, expYear: true },
    }),
  ]);

  return {
    plan: plan.code,
    planDef: plan,
    pendingPlan: sub?.pendingPlan ?? null,
    status: sub?.status ?? "INCOMPLETE",
    active: isSubscriptionActive(sub),
    accessEndsAt: sub ? accessEndsAt(sub) : null,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    autoRenew: sub?.autoRenew ?? false,
    failedAttempts: sub?.failedAttempts ?? 0,
    nextRetryAt: sub?.nextRetryAt ?? null,
    defaultCard: card,
    usage: {
      aiReplies: { used: aiUsed, limit: plan.limits.aiReplies },
      pages: { used: pages, limit: plan.limits.pages },
      knowledgeFiles: { used: files, limit: plan.limits.knowledgeFiles },
      broadcasts: { used: broadcasts, limit: plan.limits.broadcastsPerMonth },
    },
  };
}

// ───────── Account creation (email, Facebook or Instagram sign-up) ─────────

/** Starter tags + AI/keyword rules so tagging works out of the box. */
export const STARTER_TAGS = [
  { name: "Захиалга", color: "#16a34a", intent: "Хэрэглэгч бараа/үйлчилгээ авах, захиалах хүсэлтэй эсвэл захиалгаа баталгаажуулсан", keywords: ["захиал", "авъя", "авмаар", "zahial"] },
  { name: "Үнэ асуусан", color: "#2563eb", intent: "Хэрэглэгч үнэ, төлбөр, хямдралын талаар асууж байна", keywords: ["үнэ", "хэд вэ", "une", "hed ve"] },
  { name: "Цаг захиалга", color: "#9333ea", intent: "Хэрэглэгч цаг, ширээ, өрөө товлох/захиалах хүсэлтэй", keywords: [] },
  { name: "Гомдол", color: "#dc2626", intent: "Хэрэглэгч сэтгэл дундуур байна, гомдол гаргаж эсвэл асуудал мэдэгдэж байна", keywords: ["гомдол", "муу", "асуудал"] },
];

export async function createAccount(input: {
  name: string;
  email?: string | null;
  passwordHash?: string | null;
  phone?: string | null;
  fbUserId?: string | null;
  igUserId?: string | null;
  avatarUrl?: string | null;
  locale?: string;
  businessName: string;
  businessType: string;
  plan: PlanCode;
}) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email ?? null,
        passwordHash: input.passwordHash ?? null,
        name: input.name,
        phone: input.phone ?? null,
        fbUserId: input.fbUserId ?? null,
        igUserId: input.igUserId ?? null,
        avatarUrl: input.avatarUrl ?? null,
        locale: input.locale ?? "mn",
      },
    });
    const business = await tx.business.create({
      data: {
        ownerId: user.id,
        name: input.businessName,
        businessType: input.businessType,
        botSettings: DEFAULT_BOT_SETTINGS,
        profile: { fields: input.phone ? { phone: input.phone } : {}, items: [], faqs: [] },
      },
    });
    // No free trial — the bot starts working after the first payment
    await tx.subscription.create({ data: { businessId: business.id, plan: input.plan, status: "INCOMPLETE" } });
    for (const t of STARTER_TAGS) {
      const tag = await tx.tag.create({ data: { businessId: business.id, name: t.name, color: t.color } });
      await tx.tagRule.create({ data: { businessId: business.id, type: "AI_INTENT", tagId: tag.id, intent: t.intent } });
      if (t.keywords.length) {
        await tx.tagRule.create({ data: { businessId: business.id, type: "KEYWORD", tagId: tag.id, keywords: t.keywords } });
      }
    }
    return { user, business };
  });
}
