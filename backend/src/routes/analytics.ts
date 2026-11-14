import { Router } from "express";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { aiRepliesUsed, getPlanContext } from "../services/billing/subscription.ts";

export const analyticsRouter = Router();
analyticsRouter.use(requireAuth);

analyticsRouter.get("/", async (req, res) => {
  const businessId = bid(req);
  const days = Math.min(Math.max(Number(req.query.days ?? 30), 7), 90);
  const from = new Date(Date.now() - days * 86_400_000);
  const notPlayground = { NOT: { externalId: { startsWith: "playground:" } } };

  const [contactsTotal, newContacts, byPlatform, inbound, botReplies, agentMsgs, broadcastMsgs, leads, needsHuman, topTags, daily] =
    await Promise.all([
      prisma.contact.count({ where: { businessId, ...notPlayground } }),
      prisma.contact.count({ where: { businessId, ...notPlayground, createdAt: { gte: from } } }),
      prisma.contact.groupBy({ by: ["platform"], where: { businessId, ...notPlayground }, _count: { _all: true } }),
      prisma.message.count({ where: { businessId, sender: "CUSTOMER", createdAt: { gte: from }, contact: notPlayground } }),
      prisma.message.count({ where: { businessId, sender: "BOT", createdAt: { gte: from }, contact: notPlayground } }),
      prisma.message.count({ where: { businessId, sender: "AGENT", createdAt: { gte: from } } }),
      prisma.message.count({ where: { businessId, sender: "BROADCAST", createdAt: { gte: from } } }),
      prisma.lead.count({ where: { businessId, createdAt: { gte: from }, contact: notPlayground } }),
      prisma.contact.count({ where: { businessId, needsHuman: true, ...notPlayground } }),
      prisma.tag.findMany({
        where: { businessId },
        include: { _count: { select: { contacts: true } } },
        orderBy: { contacts: { _count: "desc" } },
        take: 6,
      }),
      prisma.$queryRaw<Array<{ day: string; inbound: bigint; bot: bigint }>>`
        SELECT to_char(m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
               COUNT(*) FILTER (WHERE m.sender = 'CUSTOMER') AS inbound,
               COUNT(*) FILTER (WHERE m.sender = 'BOT') AS bot
        FROM "Message" m
        JOIN "Contact" c ON c.id = m."contactId"
        WHERE m."businessId" = ${businessId}
          AND m."createdAt" >= ${from}
          AND c."externalId" NOT LIKE 'playground:%'
        GROUP BY 1 ORDER BY 1`,
    ]);

  // Day keys in Ulaanbaatar time, matching the SQL grouping
  const ubDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit" });
  const series: Array<{ date: string; inbound: number; bot: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = ubDay.format(new Date(Date.now() - i * 86_400_000));
    const row = daily.find((r) => r.day === key);
    series.push({ date: key, inbound: Number(row?.inbound ?? 0), bot: Number(row?.bot ?? 0) });
  }

  res.json({
    days,
    contactsTotal,
    newContacts,
    platforms: Object.fromEntries(byPlatform.map((p) => [p.platform, p._count._all])),
    inbound,
    botReplies,
    agentMessages: agentMsgs,
    broadcastMessages: broadcastMsgs,
    automationRate: botReplies + agentMsgs ? Math.round((botReplies / (botReplies + agentMsgs)) * 100) : 0,
    leads,
    needsHuman,
    topTags: topTags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.contacts })),
    series,
  });
});

// ───────── Full analytics (dashboard → Аналитик) ─────────

const STOPWORDS = new Set(
  (
    "сайн байна уу юу юм энэ тэр би та бид таны миний манай байгаа байх бол гэж гээд вэ бэ үү уу нь ч л аа ээ оо өө " +
    "хэд хэдэн яаж хаана хэзээ ямар ямар ба болон эсвэл бас ойлголоо за тийм үгүй баярлалаа ok okay hi hello thanks thank " +
    "the a an is are you i me my to of and or in on for it this that sain bn baina uu yu ve be bol " +
    "байна байгаа юу байдаг байна уу болох болно өгөөч өгөх авах авч хүсэж"
  ).split(/\s+/),
);

function rangeOf(daysRaw: unknown) {
  const days = Math.min(Math.max(Number(daysRaw ?? 30) || 30, 7), 365);
  const now = new Date();
  const from = new Date(now.getTime() - days * 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  return { days, now, from, prevFrom };
}

async function periodTotals(businessId: string, from: Date, to: Date) {
  const notPlayground = { NOT: { externalId: { startsWith: "playground:" } } };
  const [bySender, newContacts, leads] = await Promise.all([
    prisma.message.groupBy({
      by: ["sender"],
      where: { businessId, createdAt: { gte: from, lt: to }, contact: notPlayground },
      _count: { _all: true },
    }),
    prisma.contact.count({ where: { businessId, ...notPlayground, createdAt: { gte: from, lt: to } } }),
    prisma.lead.count({ where: { businessId, createdAt: { gte: from, lt: to }, contact: notPlayground } }),
  ]);
  const n = (s: string) => bySender.find((x) => x.sender === s)?._count._all ?? 0;
  const bot = n("BOT");
  const agent = n("AGENT");
  return {
    inbound: n("CUSTOMER"),
    bot,
    agent,
    broadcast: n("BROADCAST"),
    newContacts,
    leads,
    automationRate: bot + agent ? Math.round((bot / (bot + agent)) * 100) : 0,
    conversionRate: newContacts ? Math.round((leads / newContacts) * 1000) / 10 : 0,
  };
}

async function buildFull(businessId: string, daysRaw: unknown) {
  const { days, now, from, prevFrom } = rangeOf(daysRaw);
  const notPlayground = { NOT: { externalId: { startsWith: "playground:" } } };

  const [current, previous, daily, dailyContacts, dailyLeads, platformMsgs, platformContacts, heat, resp, funnelRows, leadTypes, leadStatuses, tags, tagSources, broadcasts, texts, sub] =
    await Promise.all([
      periodTotals(businessId, from, now),
      periodTotals(businessId, prevFrom, from),
      prisma.$queryRaw<Array<{ day: string; inbound: bigint; bot: bigint; agent: bigint; broadcast: bigint }>>`
        SELECT to_char(m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day,
               COUNT(*) FILTER (WHERE m.sender = 'CUSTOMER') AS inbound,
               COUNT(*) FILTER (WHERE m.sender = 'BOT') AS bot,
               COUNT(*) FILTER (WHERE m.sender = 'AGENT') AS agent,
               COUNT(*) FILTER (WHERE m.sender = 'BROADCAST') AS broadcast
        FROM "Message" m JOIN "Contact" c ON c.id = m."contactId"
        WHERE m."businessId" = ${businessId} AND m."createdAt" >= ${from} AND c."externalId" NOT LIKE 'playground:%'
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
        SELECT to_char("createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day, COUNT(*) AS n
        FROM "Contact" WHERE "businessId" = ${businessId} AND "createdAt" >= ${from} AND "externalId" NOT LIKE 'playground:%'
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ day: string; n: bigint }>>`
        SELECT to_char(l."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar', 'YYYY-MM-DD') AS day, COUNT(*) AS n
        FROM "Lead" l JOIN "Contact" c ON c.id = l."contactId"
        WHERE l."businessId" = ${businessId} AND l."createdAt" >= ${from} AND c."externalId" NOT LIKE 'playground:%'
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ platform: string; n: bigint }>>`
        SELECT c.platform::text AS platform, COUNT(*) AS n
        FROM "Message" m JOIN "Contact" c ON c.id = m."contactId"
        WHERE m."businessId" = ${businessId} AND m.sender = 'CUSTOMER' AND m."createdAt" >= ${from} AND c."externalId" NOT LIKE 'playground:%'
        GROUP BY 1`,
      prisma.contact.groupBy({ by: ["platform"], where: { businessId, ...notPlayground }, _count: { _all: true } }),
      prisma.$queryRaw<Array<{ dow: number; hour: number; n: number }>>`
        SELECT EXTRACT(DOW FROM (m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar'))::int AS dow,
               EXTRACT(HOUR FROM (m."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ulaanbaatar'))::int AS hour,
               COUNT(*)::int AS n
        FROM "Message" m JOIN "Contact" c ON c.id = m."contactId"
        WHERE m."businessId" = ${businessId} AND m.sender = 'CUSTOMER' AND m."createdAt" >= ${from} AND c."externalId" NOT LIKE 'playground:%'
        GROUP BY 1, 2`,
      prisma.$queryRaw<Array<{ sender: string; n: number; avg: number | null; b1: number; b2: number; b3: number; b4: number; b5: number }>>`
        SELECT sender::text AS sender, COUNT(*)::int AS n, AVG(secs)::float AS avg,
               COUNT(*) FILTER (WHERE secs < 5)::int AS b1,
               COUNT(*) FILTER (WHERE secs >= 5 AND secs < 15)::int AS b2,
               COUNT(*) FILTER (WHERE secs >= 15 AND secs < 60)::int AS b3,
               COUNT(*) FILTER (WHERE secs >= 60 AND secs < 300)::int AS b4,
               COUNT(*) FILTER (WHERE secs >= 300)::int AS b5
        FROM (
          SELECT m.sender, EXTRACT(EPOCH FROM (m."createdAt" - LAG(m."createdAt") OVER w)) AS secs, LAG(m.sender) OVER w AS prev
          FROM "Message" m JOIN "Contact" c ON c.id = m."contactId"
          WHERE m."businessId" = ${businessId} AND m."createdAt" >= ${from} AND c."externalId" NOT LIKE 'playground:%'
          WINDOW w AS (PARTITION BY m."contactId" ORDER BY m."createdAt")
        ) x
        WHERE prev = 'CUSTOMER' AND sender IN ('BOT', 'AGENT')
        GROUP BY sender`,
      prisma.$queryRaw<Array<{ new_contacts: number; engaged: number; with_lead: number; done: number }>>`
        SELECT COUNT(*)::int AS new_contacts,
               COUNT(*) FILTER (WHERE (SELECT COUNT(*) FROM "Message" m WHERE m."contactId" = c.id AND m.sender = 'CUSTOMER') >= 2)::int AS engaged,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Lead" l WHERE l."contactId" = c.id))::int AS with_lead,
               COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM "Lead" l WHERE l."contactId" = c.id AND l.status = 'DONE'))::int AS done
        FROM "Contact" c
        WHERE c."businessId" = ${businessId} AND c."createdAt" >= ${from} AND c."externalId" NOT LIKE 'playground:%'`,
      prisma.lead.groupBy({ by: ["type"], where: { businessId, createdAt: { gte: from }, contact: notPlayground }, _count: { _all: true } }),
      prisma.lead.groupBy({ by: ["status"], where: { businessId, createdAt: { gte: from }, contact: notPlayground }, _count: { _all: true } }),
      prisma.tag.findMany({
        where: { businessId },
        include: { _count: { select: { contacts: true } } },
        orderBy: { contacts: { _count: "desc" } },
        take: 10,
      }),
      prisma.contactTag.groupBy({
        by: ["source"],
        where: { tag: { businessId }, createdAt: { gte: from }, contact: notPlayground },
        _count: { _all: true },
      }),
      prisma.broadcast.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, name: true, type: true, status: true, sentCount: true, failedCount: true, skippedCount: true },
      }),
      prisma.message.findMany({
        where: { businessId, sender: "CUSTOMER", createdAt: { gte: from }, contact: notPlayground },
        select: { text: true },
        orderBy: { createdAt: "desc" },
        take: 3000,
      }),
      prisma.subscription.findUnique({ where: { businessId } }),
    ]);

  // Daily series in Ulaanbaatar days
  const ubDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "2-digit", day: "2-digit" });
  const series = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = ubDay.format(new Date(now.getTime() - i * 86_400_000));
    const d = daily.find((r) => r.day === key);
    series.push({
      date: key,
      inbound: Number(d?.inbound ?? 0),
      bot: Number(d?.bot ?? 0),
      agent: Number(d?.agent ?? 0),
      broadcast: Number(d?.broadcast ?? 0),
      newContacts: Number(dailyContacts.find((r) => r.day === key)?.n ?? 0),
      leads: Number(dailyLeads.find((r) => r.day === key)?.n ?? 0),
    });
  }

  // 7×24 heatmap (Mon-first)
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0) as number[]);
  for (const h of heat) heatmap[(h.dow + 6) % 7][h.hour] = h.n;

  // Top words
  const freq = new Map<string, number>();
  for (const { text } of texts) {
    const seen = new Set<string>();
    for (const w of text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/)) {
      if (w.length < 3 || STOPWORDS.has(w) || /^\d+$/.test(w) || seen.has(w)) continue;
      seen.add(w);
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }
  }
  const topWords = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([word, count]) => ({ word, count }));

  const respOf = (s: string) => {
    const r = resp.find((x) => x.sender === s);
    return r
      ? { count: r.n, avgSeconds: r.avg ? Math.round(r.avg * 10) / 10 : null, buckets: [r.b1, r.b2, r.b3, r.b4, r.b5] }
      : { count: 0, avgSeconds: null, buckets: [0, 0, 0, 0, 0] };
  };
  const f = funnelRows[0] ?? { new_contacts: 0, engaged: 0, with_lead: 0, done: 0 };
  const { plan } = await getPlanContext(businessId);

  return {
    days,
    from,
    current,
    previous,
    series,
    platforms: {
      messages: Object.fromEntries(platformMsgs.map((p) => [p.platform, Number(p.n)])),
      contacts: Object.fromEntries(platformContacts.map((p) => [p.platform, p._count._all])),
    },
    heatmap,
    responseTime: { bot: respOf("BOT"), agent: respOf("AGENT") },
    funnel: { newContacts: f.new_contacts, engaged: f.engaged, withLead: f.with_lead, done: f.done },
    leads: {
      byType: Object.fromEntries(leadTypes.map((x) => [x.type, x._count._all])),
      byStatus: Object.fromEntries(leadStatuses.map((x) => [x.status, x._count._all])),
    },
    tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, count: t._count.contacts })),
    tagSources: Object.fromEntries(tagSources.map((x) => [x.source, x._count._all])),
    broadcasts,
    topWords,
    usage: { aiReplies: await aiRepliesUsed(businessId, sub), limit: plan.limits.aiReplies },
  };
}

analyticsRouter.get("/full", async (req, res) => {
  res.json(await buildFull(bid(req), req.query.days));
});

analyticsRouter.get("/export.csv", async (req, res) => {
  const data = await buildFull(bid(req), req.query.days);
  const head = "date,customer_messages,ai_replies,agent_messages,broadcast_messages,new_contacts,leads";
  const rows = data.series.map((s) => [s.date, s.inbound, s.bot, s.agent, s.broadcast, s.newContacts, s.leads].join(","));
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="analytics-${data.days}d.csv"`);
  res.send("﻿" + [head, ...rows].join("\n"));
});
