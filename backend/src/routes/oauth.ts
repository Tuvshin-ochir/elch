/**
 * OAuth landing URLs registered in the Meta App Dashboard:
 *   Facebook:  {PUBLIC_API_URL}/api/oauth/facebook/callback
 *   Instagram: {PUBLIC_API_URL}/api/oauth/instagram/callback
 * `state` (signed JWT) says what the login is for:
 *   { kind: "auth", plan }     → sign up / log in to our app
 *   { kind: "connect", bid }   → connect a channel to an existing business
 */
import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.ts";
import { prisma, type PlanCode } from "../lib/prisma.ts";
import { signToken } from "../middleware/auth.ts";
import { createAccount } from "../services/account.ts";
import { connectInstagramAccount, saveMetaAccount } from "../services/meta/connect.ts";
import * as graph from "../services/meta/graph.ts";

export const oauthRouter = Router();

type State = { kind: "auth"; plan: PlanCode } | { kind: "connect"; bid: string };

function readState(raw: unknown): State | null {
  try {
    return jwt.verify(String(raw ?? ""), config.jwtSecret) as State;
  } catch {
    return null;
  }
}

/** Hand the session to the frontend in the URL fragment (never sent to servers / logs). */
function finishAuth(res: Response, userId: string, isNew: boolean, plan?: string) {
  const hash = new URLSearchParams({ token: signToken(userId), new: isNew ? "1" : "0", ...(plan ? { plan } : {}) });
  res.redirect(`${config.appUrl}/auth/complete#${hash}`);
}

function fail(res: Response, kind: State["kind"] | undefined, msg: string, provider: "fb" | "ig") {
  if (kind === "connect") return res.redirect(`${config.appUrl}/dashboard/channels?${provider}=error&msg=${encodeURIComponent(msg)}`);
  res.redirect(`${config.appUrl}/auth/complete#${new URLSearchParams({ error: msg })}`);
}

oauthRouter.get("/facebook/callback", async (req, res) => {
  const state = readState(req.query.state);
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!state) return fail(res, undefined, "Хугацаа дууссан, дахин оролдоно уу", "fb");
  if (!code) return fail(res, state.kind, String(req.query.error_description ?? "Facebook нэвтрэлтийг цуцаллаа"), "fb");

  try {
    const r = await graph.exchangeCode(code, graph.fbRedirectUri());

    if (state.kind === "connect") {
      await saveMetaAccount(state.bid, r);
      return res.redirect(`${config.appUrl}/dashboard/channels?fb=connected`);
    }

    // Sign up / log in
    let user = await prisma.user.findUnique({ where: { fbUserId: r.userId } });
    if (!user && r.email) {
      user = await prisma.user.findUnique({ where: { email: r.email } });
      if (user) user = await prisma.user.update({ where: { id: user.id }, data: { fbUserId: r.userId, avatarUrl: user.avatarUrl ?? r.picture } });
    }
    let isNew = false;
    if (!user) {
      ({ user } = await createAccount({
        name: r.userName,
        email: r.email,
        fbUserId: r.userId,
        avatarUrl: r.picture,
        businessName: r.userName,
        businessType: "other",
        plan: state.plan,
      }));
      isNew = true;
    }
    const business = await prisma.business.findUniqueOrThrow({ where: { ownerId: user.id } });
    await saveMetaAccount(business.id, r); // pages can be picked right away
    finishAuth(res, user.id, isNew, state.plan);
  } catch (err) {
    fail(res, state.kind, err instanceof Error ? err.message : "Facebook error", "fb");
  }
});

oauthRouter.get("/instagram/callback", async (req, res) => {
  const state = readState(req.query.state);
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!state) return fail(res, undefined, "Хугацаа дууссан, дахин оролдоно уу", "ig");
  if (!code) return fail(res, state.kind, String(req.query.error_description ?? "Instagram нэвтрэлтийг цуцаллаа"), "ig");

  try {
    const r = await graph.igExchangeCode(code, graph.igRedirectUri());

    if (state.kind === "connect") {
      await connectInstagramAccount(state.bid, r);
      return res.redirect(`${config.appUrl}/dashboard/channels?ig=connected`);
    }

    // Sign up / log in — the Instagram account also becomes the business's first channel
    let user = await prisma.user.findUnique({ where: { igUserId: r.igAccountId } });
    let isNew = false;
    if (!user) {
      ({ user } = await createAccount({
        name: r.name,
        igUserId: r.igAccountId,
        avatarUrl: r.picture,
        businessName: r.name,
        businessType: "other",
        plan: state.plan,
      }));
      isNew = true;
    }
    const business = await prisma.business.findUniqueOrThrow({ where: { ownerId: user.id } });
    await connectInstagramAccount(business.id, r); // also refreshes the token on later logins
    finishAuth(res, user.id, isNew, state.plan);
  } catch (err) {
    fail(res, state.kind, err instanceof Error ? err.message : "Instagram error", "ig");
  }
});
