import crypto from "node:crypto";
import { config } from "../../../config.ts";
import type { CardProvider } from "./types.ts";

/**
 * Sandbox bank. The "hosted page" is the frontend route /mock-bank/checkout which
 * posts to /api/mock-bank/* (see routes/mockBank.ts).
 *
 * Test cards:
 *   4242 4242 4242 4242 → always succeeds
 *   4000 0000 0000 0002 → card saves, but every charge is declined (test auto-billing failures)
 */
export const mockCardProvider: CardProvider = {
  name: "mock",

  async createSetupSession({ sessionId }) {
    return { redirectUrl: `${config.appUrl}/mock-bank/checkout?session=${encodeURIComponent(sessionId)}` };
  },

  async charge({ token, idempotencyKey }) {
    await new Promise((r) => setTimeout(r, 400));
    if (!token.startsWith("mock_")) return { ok: false, reason: "Invalid token" };
    if (token.startsWith("mock_0002_")) return { ok: false, reason: "Insufficient funds (test card)" };
    const ref = `MOCKTX-${crypto.createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 12).toUpperCase()}`;
    return { ok: true, ref };
  },
};

export function mockTokenize(last4: string): string {
  return `mock_${last4}_${crypto.randomBytes(12).toString("hex")}`;
}
