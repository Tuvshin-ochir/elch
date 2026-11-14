import express, { Router } from "express";
import { config } from "../config.ts";
import { processWebhook } from "../services/meta/webhookHandler.ts";
import { verifySignature } from "../services/meta/graph.ts";

export const webhookRouter = Router();

// Verification handshake from the Meta App Dashboard
webhookRouter.get("/meta", (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === config.meta.verifyToken) {
    return res.status(200).send(String(req.query["hub.challenge"] ?? ""));
  }
  res.sendStatus(403);
});

webhookRouter.post("/meta", express.raw({ type: "*/*", limit: "5mb" }), (req, res) => {
  const raw = req.body as Buffer;
  if (!verifySignature(raw, req.header("x-hub-signature-256"))) return res.sendStatus(401);
  let body: unknown;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.sendStatus(400);
  }
  // Ack immediately (Meta retries slow webhooks), process asynchronously
  res.sendStatus(200);
  processWebhook(body).catch((err) => console.error("[webhook] processing failed", err));
});
