import { decrypt } from "../../lib/crypto.ts";
import { prisma } from "../../lib/prisma.ts";
import * as graph from "../meta/graph.ts";

function fmt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(fmt).filter(Boolean).join(", ");
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k}: ${fmt(x)}`)
      .join("; ");
  }
  return String(v);
}

/** Pull public info + recent posts from a connected FB page (and its Instagram) into the knowledge base. */
export async function syncPageKnowledge(connectedPageId: string) {
  const page = await prisma.connectedPage.findUniqueOrThrow({ where: { id: connectedPageId } });
  const token = decrypt(page.accessToken);

  let source = await prisma.knowledgeSource.findFirst({
    where: { businessId: page.businessId, type: "PAGE_SYNC", sourceRef: page.id },
  });
  if (!source) {
    source = await prisma.knowledgeSource.create({
      data: {
        businessId: page.businessId,
        type: "PAGE_SYNC",
        sourceRef: page.id,
        title:
          page.kind !== "FACEBOOK_LOGIN"
            ? `Instagram: @${page.igUsername ?? page.name}`
            : `Facebook: ${page.name}${page.igUsername ? ` + Instagram @${page.igUsername}` : ""}`,
        status: "PROCESSING",
      },
    });
  } else {
    await prisma.knowledgeSource.update({ where: { id: source.id }, data: { status: "PROCESSING", error: null } });
  }

  try {
    const lines: string[] = [];
    const api = graph.apiFor(page.kind);

    if (page.fbPageId) {
      const info = await graph.getPageInfo(page.fbPageId, token);
      lines.push("### Facebook page мэдээлэл");
      for (const [k, v] of Object.entries(info)) {
        if (k === "id") continue;
        const s = fmt(v);
        if (s) lines.push(`${k}: ${s}`);
      }

      const posts = await graph.getPagePosts(page.fbPageId, token).catch(() => ({ data: [] }));
      const withText = posts.data.filter((p) => p.message?.trim());
      if (withText.length) {
        lines.push("", "### Facebook-ийн сүүлийн нийтлэлүүд (шинэ → хуучин)");
        for (const p of withText) lines.push(`[${p.created_time.slice(0, 10)}] ${p.message!.trim()}`);
      }
    }

    if (page.igAccountId) {
      // Instagram Login tokens address the account as "me"
      const igId = page.kind === "INSTAGRAM_LOGIN" ? "me" : page.igAccountId;
      const ig = await graph.getIgProfile(api, igId, token).catch(() => null);
      if (ig) {
        lines.push("", "### Instagram профайл");
        if (ig.username) lines.push(`username: @${ig.username}`);
        if (ig.name) lines.push(`name: ${ig.name}`);
        if (ig.biography) lines.push(`bio: ${ig.biography}`);
        if (ig.website) lines.push(`website: ${ig.website}`);
      }
      const media = await graph.getIgMedia(api, igId, token).catch(() => ({ data: [] }));
      const captions = media.data.filter((m) => m.caption?.trim());
      if (captions.length) {
        lines.push("", "### Instagram пост тайлбарууд");
        for (const m of captions) lines.push(`[${m.timestamp.slice(0, 10)}] ${m.caption!.trim()}`);
      }
    }

    const content = lines.join("\n").slice(0, 200_000);
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { content, status: "READY", size: content.length },
    });
    await prisma.connectedPage.update({ where: { id: page.id }, data: { lastSyncedAt: new Date() } });
  } catch (err) {
    await prisma.knowledgeSource.update({
      where: { id: source.id },
      data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
    });
    throw err;
  }
}
