import bcrypt from "bcryptjs";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { BUSINESS_TYPES } from "../businessTypes.ts";
import { config } from "../config.ts";
import { badRequest, HttpError, param, parse } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth, signToken } from "../middleware/auth.ts";
import { createAccount, subscriptionSummary } from "../services/account.ts";
import * as graph from "../services/meta/graph.ts";

export const authRouter = Router();

const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });

const PlanSchema = z.enum(["STARTER", "BUSINESS", "PRO"]);
const BusinessTypeSchema = z.string().refine((t) => BUSINESS_TYPES.some((b) => b.key === t), "Unknown business type");

const RegisterSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(30).optional(),
  businessName: z.string().trim().min(2).max(120),
  businessType: BusinessTypeSchema,
  plan: PlanSchema.default("BUSINESS"),
  locale: z.enum(["mn", "en"]).default("mn"),
});

authRouter.post("/register", limiter, async (req, res) => {
  const body = parse(RegisterSchema, req.body);
  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw new HttpError(409, "Энэ имэйл бүртгэлтэй байна", "EMAIL_TAKEN");
  }
  const { user } = await createAccount({ ...body, passwordHash: await bcrypt.hash(body.password, 11) });
  res.status(201).json({ token: signToken(user.id) });
});

const LoginSchema = z.object({ email: z.string().transform((e) => e.toLowerCase().trim()), password: z.string() });

authRouter.post("/login", limiter, async (req, res) => {
  const body = parse(LoginSchema, req.body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (user && !user.passwordHash) {
    throw new HttpError(401, `Энэ бүртгэл ${user.igUserId ? "Instagram" : "Facebook"}-ээр нэвтэрдэг`, "USE_SOCIAL_LOGIN");
  }
  if (!user || !user.passwordHash || !(await bcrypt.compare(body.password, user.passwordHash))) {
    throw new HttpError(401, "Имэйл эсвэл нууц үг буруу", "INVALID_CREDENTIALS");
  }
  const business = await prisma.business.findUnique({ where: { ownerId: user.id }, select: { suspendedAt: true, suspendReason: true } });
  if (business?.suspendedAt) {
    throw new HttpError(403, `Таны бүртгэл түр хаагдсан${business.suspendReason ? `: ${business.suspendReason}` : ""}. Бидэнтэй холбогдоно уу.`, "SUSPENDED");
  }
  res.json({ token: signToken(user.id) });
});

/**
 * Sign up / log in with Facebook or Instagram.
 * Facebook also grants page permissions → pages can be picked right after.
 * Instagram connects that Instagram account as a channel automatically.
 */
authRouter.get("/oauth/:provider/start", limiter, (req, res) => {
  const provider = param(req, "provider");
  const plan = PlanSchema.catch("BUSINESS").parse(req.query.plan);
  const state = jwt.sign({ kind: "auth", plan }, config.jwtSecret, { expiresIn: "15m" });
  if (provider === "facebook") {
    if (!config.meta.enabled) throw badRequest("Facebook нэвтрэлт тохируулагдаагүй байна (META_APP_ID)", "META_NOT_CONFIGURED");
    return res.json({ url: graph.oauthDialogUrl(graph.fbRedirectUri(), state) });
  }
  if (provider === "instagram") {
    if (!config.instagram.enabled) throw badRequest("Instagram нэвтрэлт тохируулагдаагүй байна (IG_APP_ID)", "IG_NOT_CONFIGURED");
    if (!config.publicApiUrl.startsWith("https://")) throw badRequest("Instagram нэвтрэлтэд PUBLIC_API_URL нь https байх ёстой", "NEEDS_HTTPS");
    return res.json({ url: graph.igOauthDialogUrl(graph.igRedirectUri(), state) });
  }
  throw badRequest("Unknown provider");
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.userId },
    select: { id: true, email: true, name: true, phone: true, locale: true, avatarUrl: true, fbUserId: true, igUserId: true, createdAt: true },
  });
  const business = await prisma.business.findUniqueOrThrow({
    where: { id: bid(req) },
    select: { id: true, name: true, businessType: true },
  });
  res.json({ user, business, subscription: await subscriptionSummary(business.id) });
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const body = parse(
    z.object({
      name: z.string().trim().min(2).max(80).optional(),
      phone: z.string().trim().max(30).optional(),
      locale: z.enum(["mn", "en"]).optional(),
    }),
    req.body,
  );
  await prisma.user.update({ where: { id: req.userId }, data: body });
  res.json({ ok: true });
});

/** After a Facebook/Instagram sign-up: business details + plan (+ email for Instagram accounts). */
authRouter.post("/onboarding", requireAuth, async (req, res) => {
  const businessId = bid(req);
  const body = parse(
    z.object({
      businessName: z.string().trim().min(2).max(120),
      businessType: BusinessTypeSchema,
      plan: PlanSchema,
      phone: z.string().trim().max(30).optional(),
      email: z.email().transform((e) => e.toLowerCase().trim()).optional(),
    }),
    req.body,
  );
  if (body.email) {
    const other = await prisma.user.findUnique({ where: { email: body.email } });
    if (other && other.id !== req.userId) throw new HttpError(409, "Энэ имэйл бүртгэлтэй байна", "EMAIL_TAKEN");
  }
  await prisma.$transaction([
    prisma.business.update({ where: { id: businessId }, data: { name: body.businessName, businessType: body.businessType } }),
    prisma.user.update({
      where: { id: req.userId },
      data: { ...(body.phone ? { phone: body.phone } : {}), ...(body.email ? { email: body.email } : {}) },
    }),
    // Plan can be chosen freely until the first payment
    prisma.subscription.updateMany({ where: { businessId, status: "INCOMPLETE" }, data: { plan: body.plan } }),
  ]);
  res.json({ ok: true });
});
