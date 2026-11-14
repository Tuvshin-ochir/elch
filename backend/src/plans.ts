import type { PlanCode } from "./generated/prisma/enums.ts";

export interface PlanDef {
  code: PlanCode;
  price: number; // MNT per month
  name: { mn: string; en: string };
  limits: {
    pages: number; // FB page (+ its linked Instagram) connections
    aiReplies: number; // AI replies per billing month
    knowledgeFiles: number;
    broadcastsPerMonth: number | null; // null = unlimited
  };
  features: {
    aiTagging: boolean; // AI intent based auto-tagging
    commentAutoReply: boolean; // reply to post comments + private DM
    sequences: boolean; // TAG_TRIGGER + INACTIVITY scheduled messages
    imageUnderstanding: boolean; // bot understands customer photos
    leadCapture: boolean;
  };
}

export const PLANS: Record<PlanCode, PlanDef> = {
  STARTER: {
    code: "STARTER",
    price: 99_000,
    name: { mn: "Старт", en: "Starter" },
    limits: { pages: 1, aiReplies: 2_000, knowledgeFiles: 20, broadcastsPerMonth: 4 },
    features: {
      aiTagging: false,
      commentAutoReply: false,
      sequences: false,
      imageUnderstanding: false,
      leadCapture: true,
    },
  },
  BUSINESS: {
    code: "BUSINESS",
    price: 149_000,
    name: { mn: "Бизнес", en: "Business" },
    limits: { pages: 2, aiReplies: 6_000, knowledgeFiles: 100, broadcastsPerMonth: 20 },
    features: {
      aiTagging: true,
      commentAutoReply: true,
      sequences: false,
      imageUnderstanding: true,
      leadCapture: true,
    },
  },
  PRO: {
    code: "PRO",
    price: 199_000,
    name: { mn: "Про", en: "Pro" },
    limits: { pages: 5, aiReplies: 15_000, knowledgeFiles: 500, broadcastsPerMonth: null },
    features: {
      aiTagging: true,
      commentAutoReply: true,
      sequences: true,
      imageUnderstanding: true,
      leadCapture: true,
    },
  },
};

export const PLAN_CODES = Object.keys(PLANS) as PlanCode[];
