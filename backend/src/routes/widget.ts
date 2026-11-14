/**
 * Public API for the website chat widget (embedded on the business's own site).
 * CORS is open to any origin; visitors are identified by a signed token kept in their browser.
 */
import cors from "cors";
import express, { Router } from "express";
import rateLimit from "express-rate-limit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { widgetSettingsOf } from "../businessTypes.ts";
import { config } from "../config.ts";
import { randomToken } from "../lib/crypto.ts";
import { HttpError, notFound, param, parse } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { isSubscriptionActive } from "../services/billing/subscription.ts";
import { receiveCustomerMessage } from "../services/chat/engine.ts";

export const widgetRouter = Router();
widgetRouter.use(cors({ origin: true }));
widgetRouter.use(express.json({ limit: "32kb" }));

const here = path.dirname(fileURLToPath(import.meta.url));
const WIDGET_JS = fs.readFileSync(path.join(here, "../widget/widget.js"), "utf8");

/** <script src="{PUBLIC_API_URL}/widget.js" data-key="…" async></script> */
export function serveWidgetScript(_req: express.Request, res: express.Response) {
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.send(WIDGET_JS);
}

const sendLimiter = rateLimit({ windowMs: 10 * 60_000, limit: 40, standardHeaders: true, legacyHeaders: false });
const sessionLimiter = rateLimit({ windowMs: 60 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

interface VisitorToken {
  typ: "web";
  cid: string;
  bid: string;
}

async function loadBusiness(key: string) {
  const b = await prisma.business.findUnique({
    where: { widgetKey: key },
    include: { subscription: true },
  });
  if (!b) throw notFound("Widget not found");
  const settings = widgetSettingsOf(b.widgetSettings);
  return { b, settings, active: settings.enabled && !b.suspendedAt && isSubscriptionActive(b.subscription) };
}

function visitor(token: string, businessId: string): VisitorToken {
  try {
    const v = jwt.verify(token, config.jwtSecret) as VisitorToken;
    if (v.typ !== "web" || v.bid !== businessId) throw new Error();
    return v;
  } catch {
    throw new HttpError(401, "Invalid visitor session", "BAD_VISITOR");
  }
}

const publicMessage = (m: { id: string; direction: string; sender: string; text: string; createdAt: Date }) => ({
  id: m.id,
  from: m.direction === "IN" ? "visitor" : m.sender === "AGENT" ? "agent" : "bot",
  text: m.text,
  at: m.createdAt,
});

widgetRouter.get("/:key/config", async (req, res) => {
  const { b, settings, active } = await loadBusiness(param(req, "key"));
  res.json({
    active,
    title: settings.title || b.name,
    subtitle: settings.subtitle,
    welcome: settings.welcome,
    color: settings.color,
    position: settings.position,
  });
});

/** Start or resume a visitor conversation. */
widgetRouter.post("/:key/session", sessionLimiter, async (req, res) => {
  const { b, active } = await loadBusiness(param(req, "key"));
  if (!active) throw new HttpError(403, "Chat is offline", "OFFLINE");
  const body = parse(z.object({ token: z.string().optional() }), req.body);

  if (body.token) {
    try {
      const v = visitor(body.token, b.id);
      const contact = await prisma.contact.findFirst({ where: { id: v.cid, businessId: b.id } });
      if (contact) return res.json({ token: body.token });
    } catch {
      /* fall through → new visitor */
    }
  }
  const count = await prisma.contact.count({ where: { businessId: b.id, platform: "WEB" } });
  const contact = await prisma.contact.create({
    data: { businessId: b.id, platform: "WEB", externalId: `web:${randomToken(12)}`, name: `Вэб зочин #${count + 1}` },
  });
  const token = jwt.sign({ typ: "web", cid: contact.id, bid: b.id } satisfies VisitorToken, config.jwtSecret, { expiresIn: "180d" });
  res.json({ token });
});

widgetRouter.get("/:key/messages", async (req, res) => {
  const { b } = await loadBusiness(param(req, "key"));
  const v = visitor(String(req.query.token ?? ""), b.id);
  const after = typeof req.query.after === "string" && req.query.after ? new Date(req.query.after) : null;
  const msgs = await prisma.message.findMany({
    where: { contactId: v.cid, sender: { not: "SYSTEM" }, ...(after && !isNaN(+after) ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json(msgs.map(publicMessage));
});

widgetRouter.post("/:key/messages", sendLimiter, async (req, res) => {
  const { b, active } = await loadBusiness(param(req, "key"));
  if (!active) throw new HttpError(403, "Chat is offline", "OFFLINE");
  const body = parse(z.object({ token: z.string(), text: z.string().trim().min(1).max(1000), page: z.string().max(500).optional() }), req.body);
  const v = visitor(body.token, b.id);
  const contact = await prisma.contact.findFirst({ where: { id: v.cid, businessId: b.id }, include: { page: true } });
  if (!contact) throw new HttpError(401, "Invalid visitor session", "BAD_VISITOR");

  await receiveCustomerMessage({ contact, text: body.text });
  if (body.page) {
    await prisma.contact.update({ where: { id: contact.id }, data: { notes: contact.notes ?? `Эхэлсэн хуудас: ${body.page}` } });
  }
  res.status(201).json({ ok: true });
});
