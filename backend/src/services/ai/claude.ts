import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.ts";

/** Resolves ANTHROPIC_API_KEY (or an `ant auth login` profile) automatically. */
export const anthropic = new Anthropic(config.claude.apiKey ? { apiKey: config.claude.apiKey } : {});

/** Models that accept the server-side `fallbacks: "default"` refusal fallback. */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

export function fallbackParams(): { betas: ["server-side-fallback-2026-07-01"]; fallbacks: "default" } | { betas: [] } {
  return FALLBACK_MODELS.has(config.claude.model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" }
    : { betas: [] };
}

export function describeAnthropicError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "Claude API key буруу эсвэл тохируулаагүй (ANTHROPIC_API_KEY)";
  if (err instanceof Anthropic.RateLimitError) return "Claude API rate limit — түр хүлээгээд дахин оролдоно";
  if (err instanceof Anthropic.BadRequestError) {
    if (/credit balance/i.test(err.message)) {
      return "Anthropic аккаунтын кредит дууссан байна — console.anthropic.com → Plans & Billing хэсгээс цэнэглэнэ үү";
    }
    return `Claude bad request: ${err.message}`;
  }
  if (err instanceof Anthropic.APIError) return `Claude API error ${err.status}: ${err.message}`;
  if (err instanceof Error && /authentication method/i.test(err.message)) {
    return "ANTHROPIC_API_KEY тохируулаагүй байна (backend/.env)";
  }
  return err instanceof Error ? err.message : String(err);
}

/** Use Claude to read files we can't parse locally (images, scanned PDFs). */
export async function extractWithClaude(block: Anthropic.Beta.BetaContentBlockParam, hint: string): Promise<string> {
  const res = await anthropic.beta.messages.create({
    model: config.claude.model,
    max_tokens: 16000,
    ...fallbackParams(),
    output_config: { effort: "low" },
    messages: [
      {
        role: "user",
        content: [
          block,
          {
            type: "text",
            text:
              `This file (${hint}) was uploaded by a business owner as reference material for their customer-service chatbot. ` +
              "Transcribe all readable text exactly (prices, product names, phone numbers, hours, menus, tables as lines). " +
              "If it is a photo without much text, describe what it shows in a way that helps answer customer questions (products, colors, sizes, etc). " +
              "Output plain text only, keep the original language.",
          },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude declined to read this file");
  return res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
