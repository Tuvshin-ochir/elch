import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { badRequest, notFound, param, parse, planLimit } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { fetchPublicUrl } from "../lib/safeFetch.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { getPlanContext } from "../services/billing/subscription.ts";
import { extractText, stripHtml } from "../services/knowledge/extract.ts";

export const knowledgeRouter = Router();
knowledgeRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 10 } });

knowledgeRouter.get("/", async (req, res) => {
  const items = await prisma.knowledgeSource.findMany({
    where: { businessId: bid(req) },
    orderBy: { createdAt: "desc" },
  });
  res.json(
    items.map(({ content, ...rest }) => ({ ...rest, chars: content.length, preview: content.slice(0, 280) })),
  );
});

knowledgeRouter.get("/:id", async (req, res) => {
  const item = await prisma.knowledgeSource.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!item) throw notFound();
  res.json(item);
});

knowledgeRouter.post("/files", upload.array("files", 10), async (req, res) => {
  const businessId = bid(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest("Файл сонгоно уу");
  const { plan } = await getPlanContext(businessId);
  const count = await prisma.knowledgeSource.count({ where: { businessId, type: "FILE" } });
  if (count + files.length > plan.limits.knowledgeFiles) {
    throw planLimit(`Таны багц ${plan.limits.knowledgeFiles} хүртэл файл оруулах эрхтэй`);
  }

  const created = [];
  for (const file of files) {
    // multer gives latin1-decoded names; fix UTF-8 (Mongolian) filenames
    const fileName = Buffer.from(file.originalname, "latin1").toString("utf8");
    const src = await prisma.knowledgeSource.create({
      data: {
        businessId,
        type: "FILE",
        title: fileName,
        fileName,
        mimeType: file.mimetype,
        size: file.size,
        status: "PROCESSING",
      },
    });
    created.push(src);
    // Process in the background so large files don't block the request
    extractText(file.buffer, fileName, file.mimetype)
      .then((content) => prisma.knowledgeSource.update({ where: { id: src.id }, data: { content, status: "READY" } }))
      .catch((err) =>
        prisma.knowledgeSource.update({
          where: { id: src.id },
          data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
        }),
      );
  }
  res.status(201).json(created);
});

knowledgeRouter.post("/text", async (req, res) => {
  const body = parse(
    z.object({ title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(200_000) }),
    req.body,
  );
  const src = await prisma.knowledgeSource.create({
    data: { businessId: bid(req), type: "TEXT", title: body.title, content: body.content, status: "READY", size: body.content.length },
  });
  res.status(201).json(src);
});

knowledgeRouter.post("/url", async (req, res) => {
  const businessId = bid(req);
  const { url } = parse(z.object({ url: z.url() }), req.body);
  const src = await prisma.knowledgeSource.create({
    data: { businessId, type: "URL", title: url, url, status: "PROCESSING" },
  });
  fetchPublicUrl(url)
    .then(({ body, contentType }) => {
      const title = body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
      const content = (contentType.includes("html") ? stripHtml(body) : body).slice(0, 200_000);
      return prisma.knowledgeSource.update({
        where: { id: src.id },
        data: { content, status: "READY", title: title || url, size: content.length },
      });
    })
    .catch((err) =>
      prisma.knowledgeSource.update({
        where: { id: src.id },
        data: { status: "FAILED", error: err instanceof Error ? err.message : String(err) },
      }),
    );
  res.status(201).json(src);
});

knowledgeRouter.patch("/:id", async (req, res) => {
  const body = parse(
    z.object({ title: z.string().trim().min(1).max(200).optional(), content: z.string().max(400_000).optional() }),
    req.body,
  );
  const item = await prisma.knowledgeSource.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!item) throw notFound();
  const updated = await prisma.knowledgeSource.update({
    where: { id: item.id },
    data: { ...body, ...(body.content !== undefined ? { status: "READY", error: null, size: body.content.length } : {}) },
  });
  res.json(updated);
});

knowledgeRouter.delete("/:id", async (req, res) => {
  const r = await prisma.knowledgeSource.deleteMany({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!r.count) throw notFound();
  res.json({ ok: true });
});
