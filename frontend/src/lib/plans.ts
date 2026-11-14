import type { PlanDef } from "./types";

/** Mirror of backend/src/plans.ts for the public landing page (backend stays authoritative). */
export const PLANS: PlanDef[] = [
  {
    code: "STARTER",
    price: 99_000,
    name: { mn: "Старт", en: "Starter" },
    limits: { pages: 1, aiReplies: 2_000, knowledgeFiles: 20, broadcastsPerMonth: 4 },
    features: { aiTagging: false, commentAutoReply: false, sequences: false, imageUnderstanding: false, leadCapture: true },
  },
  {
    code: "BUSINESS",
    price: 149_000,
    name: { mn: "Бизнес", en: "Business" },
    limits: { pages: 2, aiReplies: 6_000, knowledgeFiles: 100, broadcastsPerMonth: 20 },
    features: { aiTagging: true, commentAutoReply: true, sequences: false, imageUnderstanding: true, leadCapture: true },
  },
  {
    code: "PRO",
    price: 199_000,
    name: { mn: "Про", en: "Pro" },
    limits: { pages: 5, aiReplies: 15_000, knowledgeFiles: 500, broadcastsPerMonth: null },
    features: { aiTagging: true, commentAutoReply: true, sequences: true, imageUnderstanding: true, leadCapture: true },
  },
];
