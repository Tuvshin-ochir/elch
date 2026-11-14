/**
 * Downloadable templates (with format + example rows) and importing a filled template back.
 *   GET  /api/templates/workbook?type=restaurant&lang=mn   → all-in-one .xlsx (instructions, info, items, Q&A)
 *   GET  /api/templates/items?type=…&format=csv|xlsx       → products / menu / services
 *   GET  /api/templates/faq?type=…&format=csv|xlsx         → questions & answers
 *   GET  /api/templates/business-info?type=…               → .txt guide for a free-form document
 *   POST /api/templates/import (auth, multipart "file")    → merge a filled template into the knowledge forms
 */
import { Router, type Response } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
import { getBusinessType, type BusinessProfile, type BusinessTypeDef } from "../businessTypes.ts";
import { badRequest } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";

export const templatesRouter = Router();

type Lang = "mn" | "en";
const langOf = (q: unknown): Lang => (q === "en" ? "en" : "mn");

const TXT = {
  mn: {
    guide: "Заавар",
    info: "Мэдээлэл",
    faq: "Асуулт хариулт",
    field: "Талбар",
    value: "Утга",
    example: "Жишээ",
    question: "Асуулт",
    answer: "Хариулт",
    steps: [
      ["Элч — мэдлэгийн сангийн загвар"],
      [""],
      ["1. «Мэдээлэл» хуудасны «Утга» баганыг бөглөнө. «Жишээ» баганыг харж болно."],
      ["2. Бараа / үйлчилгээний хуудсанд мөр бүр нэг бараа. Жишээ мөрүүдийг өөрийн мэдээллээр солино."],
      ["3. «Асуулт хариулт» хуудсанд хэрэглэгчдийн байнга асуудаг асуултыг бичнэ."],
      ["4. Баганын нэрийг (эхний мөр) өөрчилж болохгүй."],
      ["5. Dashboard → Мэдлэгийн сан → «Загвар оруулах» товчоор энэ файлаа оруулна."],
      [""],
      ["Зөвлөгөө: үнэ, хэмжээ, хүргэлт, цагийн хуваарийг аль болох тодорхой бичвэл бот илүү зөв хариулна."],
    ],
  },
  en: {
    guide: "Guide",
    info: "Info",
    faq: "QA",
    field: "Field",
    value: "Value",
    example: "Example",
    question: "Question",
    answer: "Answer",
    steps: [
      ["Elch — knowledge base template"],
      [""],
      ["1. Fill the «Value» column on the «Info» sheet. Use «Example» for reference."],
      ["2. On the products / services sheet, one row per item. Replace the example rows with your own."],
      ["3. On the «QA» sheet write the questions customers ask most."],
      ["4. Don't rename the column headers (first row)."],
      ["5. Dashboard → Knowledge base → «Import template» to upload this file."],
      [""],
      ["Tip: precise prices, sizes, delivery terms and hours make the bot answer better."],
    ],
  },
};

function itemsSheet(type: BusinessTypeDef, lang: Lang) {
  const cols = type.items.columns;
  const rows = [cols.map((c) => c.label[lang]), ...type.examples.map((ex) => cols.map((c) => ex[c.key] ?? ""))];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = cols.map((c) => ({ wch: c.key === "description" || c.key === "includes" ? 40 : 22 }));
  return ws;
}

function faqSheet(type: BusinessTypeDef, lang: Lang) {
  const t = TXT[lang];
  const ws = XLSX.utils.aoa_to_sheet([[t.question, t.answer], ...type.sampleFaqs.map((f) => [f.q, f.a])]);
  ws["!cols"] = [{ wch: 45 }, { wch: 70 }];
  return ws;
}

function infoSheet(type: BusinessTypeDef, lang: Lang) {
  const t = TXT[lang];
  const ws = XLSX.utils.aoa_to_sheet([[t.field, t.value, t.example], ...type.fields.map((f) => [f.label[lang], "", f.placeholder?.[lang] ?? ""])]);
  ws["!cols"] = [{ wch: 30 }, { wch: 60 }, { wch: 40 }];
  return ws;
}

const sheetName = (s: string) => s.replace(/[\\/?*[\]:]/g, " ").slice(0, 31);

function sendFile(res: Response, name: string, body: Buffer | string, type: string) {
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.send(body);
}

function sendSheet(res: Response, ws: XLSX.WorkSheet, base: string, format: unknown, name: string) {
  if (format === "csv") {
    return sendFile(res, `${base}.csv`, "﻿" + XLSX.utils.sheet_to_csv(ws), "text/csv; charset=utf-8");
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName(name));
  sendFile(res, `${base}.xlsx`, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

templatesRouter.get("/workbook", (req, res) => {
  const type = getBusinessType(String(req.query.type ?? "other"));
  const lang = langOf(req.query.lang);
  const t = TXT[lang];
  const wb = XLSX.utils.book_new();
  const guide = XLSX.utils.aoa_to_sheet(t.steps);
  guide["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, guide, t.guide);
  XLSX.utils.book_append_sheet(wb, infoSheet(type, lang), t.info);
  XLSX.utils.book_append_sheet(wb, itemsSheet(type, lang), sheetName(type.items.label[lang]));
  XLSX.utils.book_append_sheet(wb, faqSheet(type, lang), t.faq);
  sendFile(res, `elch-${type.key}-template.xlsx`, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});

templatesRouter.get("/items", (req, res) => {
  const type = getBusinessType(String(req.query.type ?? "other"));
  const lang = langOf(req.query.lang);
  sendSheet(res, itemsSheet(type, lang), `elch-${type.key}-items`, req.query.format, type.items.label[lang]);
});

templatesRouter.get("/faq", (req, res) => {
  const type = getBusinessType(String(req.query.type ?? "other"));
  const lang = langOf(req.query.lang);
  sendSheet(res, faqSheet(type, lang), `elch-${type.key}-faq`, req.query.format, TXT[lang].faq);
});

templatesRouter.get("/business-info", (req, res) => {
  const type = getBusinessType(String(req.query.type ?? "other"));
  const lang = langOf(req.query.lang);
  const en = lang === "en";
  const lines = [
    en ? `# ${type.label.en} — business information (template)` : `# ${type.label.mn} — бизнесийн мэдээлэл (загвар)`,
    "",
    en
      ? "Fill in each section and upload this file in Knowledge base → Files. Delete sections you don't need."
      : "Хэсэг бүрийг бөглөөд Мэдлэгийн сан → Файл хэсэгт оруулна. Хэрэггүй хэсгийг устгаж болно.",
    "",
    ...type.fields.flatMap((f) => [`## ${f.label[lang]}`, f.placeholder?.[lang] ? `${en ? "e.g." : "Жишээ:"} ${f.placeholder[lang]}` : "...", ""]),
    `## ${type.items.label[lang]}`,
    ...type.examples.map((ex) => "- " + type.items.columns.map((c) => (ex[c.key] ? `${c.label[lang]}: ${ex[c.key]}` : "")).filter(Boolean).join(" | ")),
    "",
    `## ${en ? "Frequently asked questions" : "Түгээмэл асуулт"}`,
    ...type.sampleFaqs.flatMap((f) => [`${en ? "Q" : "Асуулт"}: ${f.q}`, `${en ? "A" : "Хариулт"}: ${f.a}`, ""]),
    `## ${en ? "Policies (returns, cancellations, warranty)" : "Нөхцөл, журам (буцаалт, цуцлалт, баталгаа)"}`,
    "...",
  ];
  sendFile(res, `elch-${type.key}-business-info.txt`, "﻿" + lines.join("\n"), "text/plain; charset=utf-8");
});

// ───────── Import a filled template ─────────

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

templatesRouter.post("/import", requireAuth, upload.single("file"), async (req, res) => {
  const file = req.file;
  if (!file) throw badRequest("Файл сонгоно уу");
  const name = Buffer.from(file.originalname, "latin1").toString("utf8").toLowerCase();
  let wb: XLSX.WorkBook;
  try {
    wb = /\.(csv|tsv|txt)$/.test(name) ? XLSX.read(file.buffer.toString("utf8").replace(/^﻿/, ""), { type: "string" }) : XLSX.read(file.buffer, { type: "buffer" });
  } catch {
    throw badRequest("Файлыг уншиж чадсангүй. Загварын Excel эсвэл CSV файл оруулна уу.");
  }

  const business = await prisma.business.findUniqueOrThrow({ where: { id: bid(req) } });
  const type = getBusinessType(business.businessType);
  const profile = { fields: {}, items: [], faqs: [], ...(business.profile as BusinessProfile) } as Required<BusinessProfile>;
  const isExampleItem = (it: Record<string, string>) => type.examples.some((ex) => type.items.columns.every((c) => (ex[c.key] ?? "") === (it[c.key] ?? "")));
  const isExampleFaq = (q: string, a: string) => type.sampleFaqs.some((f) => f.q === q && f.a === a);
  const added = { items: 0, faqs: 0, fields: 0 };

  for (const sn of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sn], { header: 1, defval: "", raw: false });
    if (rows.length < 2) continue;
    const header = rows[0].map(norm);
    const body = rows.slice(1).filter((r) => r.some((v) => String(v).trim()));

    // Q&A sheet
    const qi = header.findIndex((h) => ["асуулт", "question", "q"].includes(h));
    const ai = header.findIndex((h) => ["хариулт", "answer", "a"].includes(h));
    if (qi >= 0 && ai >= 0) {
      for (const r of body) {
        const q = String(r[qi] ?? "").trim();
        const a = String(r[ai] ?? "").trim();
        if (!q || !a || isExampleFaq(q, a) || profile.faqs.some((f) => norm(f.q) === norm(q))) continue;
        profile.faqs.push({ q, a });
        added.faqs++;
      }
      continue;
    }

    // Info sheet (Field | Value)
    const fi = header.findIndex((h) => ["талбар", "field"].includes(h));
    const vi = header.findIndex((h) => ["утга", "value"].includes(h));
    if (fi >= 0 && vi >= 0) {
      for (const r of body) {
        const label = norm(r[fi]);
        const value = String(r[vi] ?? "").trim();
        const field = type.fields.find((f) => norm(f.label.mn) === label || norm(f.label.en) === label || norm(f.key) === label);
        if (!field || !value) continue;
        profile.fields[field.key] = value;
        added.fields++;
      }
      continue;
    }

    // Items sheet: match headers to this business type's columns
    const map = header.map((h) => type.items.columns.find((c) => [norm(c.key), norm(c.label.mn), norm(c.label.en)].includes(h))?.key ?? null);
    if (!map.some(Boolean)) continue;
    for (const r of body) {
      const it: Record<string, string> = {};
      map.forEach((key, i) => {
        if (key && String(r[i] ?? "").trim()) it[key] = String(r[i]).trim();
      });
      if (!Object.keys(it).length || isExampleItem(it)) continue;
      if (it.name && profile.items.some((x) => norm(x.name) === norm(it.name))) continue;
      profile.items.push(it);
      added.items++;
    }
  }

  if (!added.items && !added.faqs && !added.fields) {
    throw badRequest("Шинэ мэдээлэл олдсонгүй. Загварын баганын нэрийг өөрчлөөгүй, жишээ мөрүүдийг өөрийн мэдээллээр сольсон эсэхээ шалгана уу.");
  }
  await prisma.business.update({ where: { id: business.id }, data: { profile } });
  res.json({ ok: true, added });
});
