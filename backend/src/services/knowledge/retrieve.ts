import { getBusinessType, profileToText, type BusinessProfile } from "../../businessTypes.ts";
import { prisma } from "../../lib/prisma.ts";

/** Below this size the whole knowledge base goes into the (cached) prompt. */
const FULL_CONTEXT_CHARS = 150_000;
const CHUNK = 1_500;
const SELECT_BUDGET = 60_000;

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);

export interface KnowledgeContext {
  text: string;
  /** true when the text is identical for every question (safe to prompt-cache) */
  stable: boolean;
}

export async function buildKnowledge(businessId: string, query: string): Promise<KnowledgeContext> {
  const business = await prisma.business.findUniqueOrThrow({ where: { id: businessId } });
  const type = getBusinessType(business.businessType);
  const profileText = profileToText(type, business.profile as BusinessProfile);

  const sources = await prisma.knowledgeSource.findMany({
    where: { businessId, status: "READY" },
    orderBy: { createdAt: "asc" },
    select: { title: true, type: true, content: true },
  });

  const header = `# ${business.name} (${type.label.mn})\n${profileText}`;
  const total = sources.reduce((n, s) => n + s.content.length, 0);

  if (total <= FULL_CONTEXT_CHARS) {
    const docs = sources.map((s) => `\n\n## [${s.type}] ${s.title}\n${s.content}`).join("");
    return { text: header + docs, stable: true };
  }

  // Large knowledge base → keyword-scored chunk selection for this question
  const q = new Set(tokenize(query));
  const chunks: Array<{ title: string; text: string; score: number }> = [];
  for (const s of sources) {
    for (let i = 0; i < s.content.length; i += CHUNK) {
      const text = s.content.slice(i, i + CHUNK + 200);
      const words = tokenize(text);
      let score = 0;
      for (const w of words) if (q.has(w)) score++;
      // prefix match helps with Mongolian suffixes (үнэ / үнэтэй / үнийг)
      for (const qw of q) if (qw.length >= 4 && words.some((w) => w !== qw && w.startsWith(qw.slice(0, 4)))) score += 0.5;
      chunks.push({ title: s.title, text, score });
    }
  }
  chunks.sort((a, b) => b.score - a.score);
  let used = 0;
  const picked: string[] = [];
  for (const c of chunks) {
    if (used + c.text.length > SELECT_BUDGET) break;
    picked.push(`\n\n## ${c.title}\n${c.text}`);
    used += c.text.length;
  }
  return { text: header + picked.join(""), stable: false };
}
