import cron from "node-cron";
import { prisma, type Broadcast, type Recurrence } from "../lib/prisma.ts";
import { chargeSavedCard, settleQPayPayment } from "./billing/charge.ts";
import { isInvoicePaid } from "./billing/qpay.ts";
import { GRACE_DAYS, accessEndsAt, isSubscriptionActive } from "./billing/subscription.ts";
import { sendToContact, withinWindow } from "./chat/send.ts";
import { decrypt, encrypt } from "../lib/crypto.ts";
import { igRefreshToken } from "./meta/graph.ts";
import { parseFilters, segmentWhere } from "./segment.ts";

const MIN = 60_000;
const DAY = 86_400_000;

function nextOccurrence(from: Date, r: Recurrence, now: Date): Date {
  const d = new Date(from);
  while (d <= now) {
    if (r === "DAILY") d.setDate(d.getDate() + 1);
    else if (r === "WEEKLY") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  }
  return d;
}

/** Contacts targeted by a broadcast: tags + segment filters (age, gender, location, …). */
function audienceWhere(b: Pick<Broadcast, "businessId" | "tagIds" | "filters">) {
  return segmentWhere(b.businessId, b.tagIds, parseFilters(b.filters));
}

export function personalize(text: string, name?: string | null) {
  const first = name?.split(" ")[0] ?? "";
  return text.replace(/\{\{\s*first_name\s*\}\}/gi, first).replace(/\{\{\s*name\s*\}\}/gi, name ?? "").replace(/\s+([,!.?])/g, "$1");
}

/** 1) ONE_TIME / RECURRING: enqueue deliveries when due */
async function enqueueScheduled(now: Date) {
  const due = await prisma.broadcast.findMany({
    where: { status: "ACTIVE", type: { in: ["ONE_TIME", "RECURRING"] }, nextRunAt: { lte: now } },
  });
  for (const b of due) {
    const runAt = b.nextRunAt!;
    const contacts = await prisma.contact.findMany({ where: audienceWhere(b), select: { id: true } });
    await prisma.broadcastDelivery.createMany({
      data: contacts.map((c) => ({ broadcastId: b.id, contactId: c.id, anchor: `run:${runAt.toISOString()}`, sendAt: now })),
      skipDuplicates: true,
    });
    await prisma.broadcast.update({
      where: { id: b.id },
      data:
        b.type === "RECURRING" && b.recurrence
          ? { lastRunAt: now, nextRunAt: nextOccurrence(runAt, b.recurrence, now) }
          : { lastRunAt: now, nextRunAt: null, status: "DONE" },
    });
  }
}

/** 2) INACTIVITY: follow up N minutes after the customer's last message */
async function enqueueInactivity(now: Date) {
  const campaigns = await prisma.broadcast.findMany({ where: { status: "ACTIVE", type: "INACTIVITY" } });
  for (const b of campaigns) {
    const delay = (b.delayMinutes ?? 60) * MIN;
    const contacts = await prisma.contact.findMany({
      where: {
        ...audienceWhere(b),
        lastInboundAt: {
          lte: new Date(now.getTime() - delay),
          gt: new Date(Math.max(b.createdAt.getTime(), now.getTime() - delay - 2 * DAY)),
        },
      },
      select: { id: true, lastInboundAt: true },
    });
    if (!contacts.length) continue;
    await prisma.broadcastDelivery.createMany({
      data: contacts.map((c) => ({
        broadcastId: b.id,
        contactId: c.id,
        anchor: `inbound:${c.lastInboundAt!.toISOString()}`,
        sendAt: now,
      })),
      skipDuplicates: true,
    });
  }
}

/** 3) Send due deliveries (all broadcast types) */
async function sendDue(now: Date) {
  const due = await prisma.broadcastDelivery.findMany({
    where: { status: "PENDING", sendAt: { lte: now } },
    include: { broadcast: true, contact: { include: { page: true, tags: true } } },
    orderBy: { sendAt: "asc" },
    take: 200,
  });

  const subCache = new Map<string, boolean>();
  for (const d of due) {
    const { broadcast: b, contact } = d;
    if (b.status === "PAUSED" || b.status === "DRAFT") continue;

    const skip = async (reason: string) => {
      await prisma.broadcastDelivery.update({ where: { id: d.id }, data: { status: "SKIPPED", error: reason } });
      await prisma.broadcast.update({ where: { id: b.id }, data: { skippedCount: { increment: 1 } } });
    };

    if (!subCache.has(b.businessId)) {
      const biz = await prisma.business.findUnique({ where: { id: b.businessId }, select: { suspendedAt: true, subscription: true } });
      subCache.set(b.businessId, !biz?.suspendedAt && isSubscriptionActive(biz?.subscription ?? null));
    }
    if (!subCache.get(b.businessId)) { await skip("Subscription inactive"); continue; }
    if (!contact.page) { await skip("Page disconnected"); continue; }
    if (b.type === "TAG_TRIGGER" && !contact.tags.some((t) => b.tagIds.includes(t.tagId))) {
      await skip("Tag removed"); continue;
    }
    // Segment may have changed since enqueueing (e.g. TAG_TRIGGER) — re-check the contact still matches
    if (!(await prisma.contact.count({ where: { AND: [{ id: contact.id }, audienceWhere(b)] } }))) {
      await skip("Does not match audience filters"); continue;
    }
    if (b.type === "INACTIVITY" && contact.lastInboundAt && d.anchor !== `inbound:${contact.lastInboundAt.toISOString()}`) {
      await skip("Customer became active again"); continue;
    }
    const inWindow = withinWindow(contact, now.getTime());
    if (!inWindow && !b.messageTag) { await skip("Outside 24h messaging window"); continue; }
    // Instagram has no promotional/utility message tags → only inside the 24h window
    if (!inWindow && contact.platform === "INSTAGRAM") { await skip("Instagram: outside 24h messaging window"); continue; }
    if (!(contact.platform === "INSTAGRAM" ? contact.page.igEnabled : contact.page.fbEnabled)) { await skip("Channel automation is off"); continue; }

    try {
      await sendToContact({
        contact,
        text: personalize(b.message, contact.name),
        sender: "BROADCAST",
        tag: inWindow ? null : b.messageTag,
        messagingType: inWindow ? "UPDATE" : "MESSAGE_TAG",
      });
      await prisma.broadcastDelivery.update({ where: { id: d.id }, data: { status: "SENT", sentAt: new Date() } });
      await prisma.broadcast.update({ where: { id: b.id }, data: { sentCount: { increment: 1 } } });
    } catch (err) {
      await prisma.broadcastDelivery.update({
        where: { id: d.id },
        data: { status: "FAILED", error: err instanceof Error ? err.message.slice(0, 500) : String(err) },
      });
      await prisma.broadcast.update({ where: { id: b.id }, data: { failedCount: { increment: 1 } } });
    }
    await new Promise((r) => setTimeout(r, 120)); // stay well below Meta's send rate limits
  }
}

/** Auto-renew with saved card, retry failures, expire unpaid subscriptions. */
export async function runBilling(now = new Date()) {
  const renewBefore = new Date(now.getTime() + 60 * MIN);
  const candidates = await prisma.subscription.findMany({
    where: {
      autoRenew: true,
      status: { in: ["ACTIVE", "PAST_DUE"] },
      OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
      // never charge a business that an admin suspended
      business: { suspendedAt: null },
    },
  });
  for (const sub of candidates) {
    const end = accessEndsAt(sub);
    if (!end || end > renewBefore) continue;
    const plan = sub.pendingPlan ?? sub.plan;
    const r = await chargeSavedCard({ businessId: sub.businessId, plan, isAutoCharge: true });
    if (r.ok) {
      console.log(`[billing] auto-renewed ${sub.businessId} → ${plan}`);
      continue;
    }
    const attempts = sub.failedAttempts + 1;
    await prisma.subscription.update({
      where: { id: sub.id },
      data:
        attempts >= 3
          ? { status: "EXPIRED", failedAttempts: attempts, nextRetryAt: null }
          : {
              status: "PAST_DUE",
              failedAttempts: attempts,
              nextRetryAt: new Date(now.getTime() + DAY),
              currentPeriodEnd: sub.currentPeriodEnd,
            },
    });
    console.warn(`[billing] auto-charge failed for ${sub.businessId} (attempt ${attempts}): ${r.reason}`);
  }

  // Expire
  await prisma.subscription.updateMany({
    where: { status: "ACTIVE", autoRenew: false, currentPeriodEnd: { lt: now } },
    data: { status: "EXPIRED" },
  });
  await prisma.subscription.updateMany({
    where: { status: "PAST_DUE", currentPeriodEnd: { lt: new Date(now.getTime() - GRACE_DAYS * DAY) } },
    data: { status: "EXPIRED" },
  });

  // Abandoned QPay invoices
  await prisma.payment.updateMany({
    where: { status: "PENDING", method: "QPAY", createdAt: { lt: new Date(now.getTime() - DAY) } },
    data: { status: "CANCELED" },
  });
}

/** Instagram Login tokens live 60 days — refresh the ones expiring within 10 days. */
async function refreshInstagramTokens(now: Date) {
  const due = await prisma.connectedPage.findMany({
    where: { kind: "INSTAGRAM_LOGIN", tokenExpiresAt: { lt: new Date(now.getTime() + 10 * DAY) } },
  });
  for (const p of due) {
    try {
      const r = await igRefreshToken(decrypt(p.accessToken));
      await prisma.connectedPage.update({
        where: { id: p.id },
        data: { accessToken: encrypt(r.access_token), tokenExpiresAt: new Date(now.getTime() + r.expires_in * 1000) },
      });
    } catch (err) {
      console.warn(`[ig-token] refresh failed for ${p.igUsername}:`, err instanceof Error ? err.message : err);
    }
  }
}

/** Backup for missed QPay callbacks: poll recent pending invoices. */
async function pollQPay(now: Date) {
  const pending = await prisma.payment.findMany({
    where: {
      status: "PENDING",
      method: "QPAY",
      qpayInvoiceId: { not: null, startsWith: "" },
      createdAt: { gt: new Date(now.getTime() - 60 * MIN) },
      NOT: { qpayInvoiceId: { startsWith: "mock_" } },
    },
    take: 50,
  });
  for (const p of pending) {
    if (await isInvoicePaid(p.qpayInvoiceId!).catch(() => false)) await settleQPayPayment(p.id);
  }
}

function guarded(name: string, fn: () => Promise<void>) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (err) {
      console.error(`[cron:${name}]`, err);
    } finally {
      running = false;
    }
  };
}

export function startScheduler() {
  cron.schedule(
    "* * * * *",
    guarded("messages", async () => {
      const now = new Date();
      await enqueueScheduled(now);
      await enqueueInactivity(now);
      await sendDue(now);
      await pollQPay(now);
    }),
  );
  cron.schedule("*/10 * * * *", guarded("billing", () => runBilling()));
  cron.schedule("17 3 * * *", guarded("ig-tokens", () => refreshInstagramTokens(new Date())));
  cron.schedule(
    "5 * * * *",
    guarded("ad-stats", async () => {
      const { syncAdStats } = await import("../routes/ads.ts");
      for (const c of await prisma.adCampaign.findMany({ where: { status: "ACTIVE" } })) {
        await syncAdStats(c).catch((e) => console.warn("[ad-stats]", c.id, e instanceof Error ? e.message : e));
      }
    }),
  );
  console.log("⏰ scheduler started (messages: every minute, billing: every 10 minutes)");
}
