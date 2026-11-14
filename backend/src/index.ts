import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import { config } from "./config.ts";
import { errorHandler, HttpError } from "./lib/http.ts";
import { prisma } from "./lib/prisma.ts";
import type { AuthPayload } from "./middleware/auth.ts";
import { adminRouter } from "./routes/admin.ts";
import { adsRouter } from "./routes/ads.ts";
import { analyticsRouter } from "./routes/analytics.ts";
import { authRouter } from "./routes/auth.ts";
import { billingPublicRouter, billingRouter } from "./routes/billing.ts";
import { broadcastsRouter } from "./routes/broadcasts.ts";
import { businessRouter, publicRouter } from "./routes/business.ts";
import { contactsRouter } from "./routes/contacts.ts";
import { knowledgeRouter } from "./routes/knowledge.ts";
import { leadsRouter } from "./routes/leads.ts";
import { metaRouter } from "./routes/meta.ts";
import { oauthRouter } from "./routes/oauth.ts";
import { mockBankRouter } from "./routes/mockBank.ts";
import { playgroundRouter } from "./routes/playground.ts";
import { tagRulesRouter, tagsRouter } from "./routes/tags.ts";
import { templatesRouter } from "./routes/templates.ts";
import { webhookRouter } from "./routes/webhooks.ts";
import { serveWidgetScript, widgetRouter } from "./routes/widget.ts";
import { subscribe } from "./services/realtime.ts";
import { startScheduler } from "./services/scheduler.ts";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(morgan(config.isProd ? "combined" : "dev"));

// Website chat widget: public script + API callable from any website (own CORS policy)
app.get("/widget.js", serveWidgetScript);
app.use("/api/widget", widgetRouter);

app.use(cors({ origin: [config.appUrl, ...config.extraOrigins], credentials: true }));

// Webhooks need the raw body for signature verification → mount before express.json
app.use("/webhooks", webhookRouter);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/api", publicRouter);
app.use("/api/auth", authRouter);
app.use("/api/business", businessRouter);
app.use("/api/billing", billingPublicRouter);
app.use("/api/billing", billingRouter);
if (config.cardProvider === "mock" && config.mockPaymentsAllowed) app.use("/api/mock-bank", mockBankRouter);
app.use("/api/oauth", oauthRouter);
app.use("/api/meta", metaRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/contacts", contactsRouter);
app.use("/api/tags", tagsRouter);
app.use("/api/tag-rules", tagRulesRouter);
app.use("/api/broadcasts", broadcastsRouter);
app.use("/api/leads", leadsRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/playground", playgroundRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/ads", adsRouter);
app.use("/api/admin", adminRouter);

// Live inbox updates (EventSource can't send headers → token in query)
app.get("/api/events", async (req, res) => {
  const token = String(req.query.token ?? "");
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
  } catch {
    throw new HttpError(401, "Unauthorized");
  }
  const business = await prisma.business.findUnique({ where: { ownerId: payload.uid }, select: { id: true } });
  if (!business) throw new HttpError(401, "Unauthorized");
  subscribe(business.id, res);
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 API on http://localhost:${config.port}`);
  console.log(`   Meta webhook: ${config.publicApiUrl}/webhooks/meta ${config.meta.enabled ? "" : "(META_APP_ID not set)"}`);
  console.log(`   QPay: ${config.qpay.mock ? "MOCK mode" : config.qpay.baseUrl} | Card provider: ${config.cardProvider}`);
  if (!config.qpayAvailable && !config.cardAvailable) console.log("   Payments: MANUAL — customers pay by bank transfer, activate them in /admin");
  console.log(`   Claude model: ${config.claude.model} (effort ${config.claude.effort})`);
  startScheduler();
});
