import { Router } from "express";
import { z } from "zod";
import { BUSINESS_TYPES, DEFAULT_BOT_SETTINGS, getBusinessType, widgetSettingsOf } from "../businessTypes.ts";
import { config } from "../config.ts";
import { CITIES, UB_DISTRICTS } from "../locations.ts";
import { parse } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { PLANS } from "../plans.ts";

export const publicRouter = Router();

publicRouter.get("/plans", (_req, res) => {
  res.json({
    plans: Object.values(PLANS),
    qpayMock: config.qpay.mock,
    cardProvider: config.cardProvider,
    social: {
      facebook: config.meta.enabled,
      instagram: config.instagramConnect !== null,
    },
  });
});

publicRouter.get("/locations", (_req, res) => {
  res.json({ cities: CITIES, districts: UB_DISTRICTS });
});

publicRouter.get("/business-types", (_req, res) => {
  res.json(BUSINESS_TYPES);
});

export const businessRouter = Router();
businessRouter.use(requireAuth);

businessRouter.get("/", async (req, res) => {
  const b = await prisma.business.findUniqueOrThrow({ where: { id: bid(req) } });
  res.json({
    id: b.id,
    name: b.name,
    businessType: b.businessType,
    typeDef: getBusinessType(b.businessType),
    profile: { fields: {}, items: [], faqs: [], ...(b.profile as object) },
    botSettings: { ...DEFAULT_BOT_SETTINGS, ...(b.botSettings as object) },
  });
});

const ProfileSchema = z.object({
  fields: z.record(z.string(), z.string().max(5000)).default({}),
  items: z.array(z.record(z.string(), z.string().max(2000))).max(1000).default([]),
  faqs: z.array(z.object({ q: z.string().max(1000), a: z.string().max(5000) })).max(300).default([]),
});

const BotSettingsSchema = z.object({
  enabled: z.boolean(),
  botName: z.string().max(60),
  tone: z.enum(["friendly", "formal", "playful"]),
  useEmoji: z.boolean(),
  greeting: z.string().max(500),
  handoffMessage: z.string().max(500),
  customInstructions: z.string().max(4000),
  collectLeads: z.boolean(),
  askProfile: z.boolean(),
});

businessRouter.patch("/", async (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(120).optional(),
      businessType: z.string().refine((t) => BUSINESS_TYPES.some((b) => b.key === t)).optional(),
      profile: ProfileSchema.optional(),
      botSettings: BotSettingsSchema.partial().optional(),
    }),
    req.body,
  );
  const current = await prisma.business.findUniqueOrThrow({ where: { id: bid(req) } });
  await prisma.business.update({
    where: { id: current.id },
    data: {
      name: body.name,
      businessType: body.businessType,
      profile: body.profile,
      botSettings: body.botSettings
        ? { ...DEFAULT_BOT_SETTINGS, ...(current.botSettings as object), ...body.botSettings }
        : undefined,
    },
  });
  res.json({ ok: true });
});

// ───────── Website chat widget settings ─────────

businessRouter.get("/widget", async (req, res) => {
  const b = await prisma.business.findUniqueOrThrow({ where: { id: bid(req) } });
  const scriptUrl = `${config.publicApiUrl}/widget.js`;
  res.json({
    widgetKey: b.widgetKey,
    settings: widgetSettingsOf(b.widgetSettings),
    scriptUrl,
    embedCode: `<script src="${scriptUrl}" data-key="${b.widgetKey}" async></script>`,
  });
});

businessRouter.patch("/widget", async (req, res) => {
  const body = parse(
    z.object({
      enabled: z.boolean().optional(),
      title: z.string().max(60).optional(),
      subtitle: z.string().max(100).optional(),
      welcome: z.string().max(300).optional(),
      color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      position: z.enum(["right", "left"]).optional(),
    }),
    req.body,
  );
  const b = await prisma.business.findUniqueOrThrow({ where: { id: bid(req) } });
  const settings = { ...widgetSettingsOf(b.widgetSettings), ...body };
  await prisma.business.update({ where: { id: b.id }, data: { widgetSettings: settings } });
  res.json({ settings });
});
