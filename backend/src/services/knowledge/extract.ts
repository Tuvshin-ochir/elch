import path from "node:path";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import * as XLSX from "xlsx";
import { extractWithClaude } from "../ai/claude.ts";

const MAX_CHARS = 400_000;

const IMAGE_TYPES: Record<string, "image/jpeg" | "image/png" | "image/gif" | "image/webp"> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

async function pptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/g)!.pop()) - Number(b.match(/\d+/g)!.pop()));
  const out: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.files[name].async("string");
    const texts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    if (texts.length) out.push(`Slide ${i + 1}: ${texts.join(" ")}`);
  }
  return out.join("\n");
}

function looksLikeText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 4000);
  let bad = 0;
  for (const b of sample) if (b === 0 || (b < 9 && b !== 0)) bad++;
  return bad / Math.max(sample.length, 1) < 0.01;
}

/** Extract plain text from any uploaded file. Falls back to Claude for images / scanned PDFs. */
export async function extractText(buffer: Buffer, fileName: string, mimeType: string): Promise<string> {
  const ext = path.extname(fileName).toLowerCase();
  let text = "";

  if (ext === ".pdf" || mimeType === "application/pdf") {
    try {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const r = await parser.getText();
      await parser.destroy();
      text = r.text;
    } catch {
      text = "";
    }
    if (text.replace(/\s/g, "").length < 50) {
      // Scanned PDF → let Claude read it
      text = await extractWithClaude(
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
        fileName,
      );
    }
  } else if (ext === ".docx") {
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if ([".xlsx", ".xls", ".ods", ".csv"].includes(ext)) {
    const wb = XLSX.read(buffer, { type: "buffer" });
    text = wb.SheetNames.map((n) => `### ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join("\n\n");
  } else if (ext === ".pptx") {
    text = await pptxText(buffer);
  } else if (IMAGE_TYPES[ext] || mimeType.startsWith("image/")) {
    const media = IMAGE_TYPES[ext] ?? (mimeType as "image/png");
    text = await extractWithClaude(
      { type: "image", source: { type: "base64", media_type: media, data: buffer.toString("base64") } },
      fileName,
    );
  } else if ([".html", ".htm"].includes(ext)) {
    text = stripHtml(buffer.toString("utf8"));
  } else if (looksLikeText(buffer)) {
    // txt, md, json, csv-like, xml, etc.
    text = buffer.toString("utf8");
  } else {
    throw new Error(`"${ext || mimeType}" төрлийн файлыг уншиж чадсангүй. PDF, Word, Excel, PowerPoint, зураг, текст файл оруулна уу.`);
  }

  text = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) throw new Error("Файлаас текст олдсонгүй");
  return text.slice(0, MAX_CHARS);
}
