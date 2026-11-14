import { Router } from "express";
import { z } from "zod";
import { badRequest, notFound, param, parse, planLimit } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";
import { getPlanContext } from "../services/billing/subscription.ts";

export const tagsRouter = Router();
tagsRouter.use(requireAuth);

const Color = z.string().regex(/^#[0-9a-fA-F]{6}$/);

tagsRouter.get("/", async (req, res) => {
  const tags = await prisma.tag.findMany({
    where: { businessId: bid(req) },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { contacts: true } } },
  });
  res.json(tags.map(({ _count, ...t }) => ({ ...t, contactCount: _count.contacts })));
});

tagsRouter.post("/", async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(1).max(40), color: Color.default("#6366f1") }), req.body);
  const exists = await prisma.tag.findUnique({ where: { businessId_name: { businessId: bid(req), name: body.name } } });
  if (exists) throw badRequest("Ийм нэртэй tag байна");
  res.status(201).json(await prisma.tag.create({ data: { businessId: bid(req), ...body } }));
});

tagsRouter.patch("/:id", async (req, res) => {
  const body = parse(z.object({ name: z.string().trim().min(1).max(40).optional(), color: Color.optional() }), req.body);
  const tag = await prisma.tag.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!tag) throw notFound();
  res.json(await prisma.tag.update({ where: { id: tag.id }, data: body }));
});

tagsRouter.delete("/:id", async (req, res) => {
  const r = await prisma.tag.deleteMany({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!r.count) throw notFound();
  res.json({ ok: true });
});

// ───────── Automatic tagging rules ─────────

export const tagRulesRouter = Router();
tagRulesRouter.use(requireAuth);

const RuleSchema = z.object({
  type: z.enum(["KEYWORD", "AI_INTENT", "COMMENT"]),
  tagId: z.string(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(50).default([]),
  intent: z.string().trim().max(500).nullable().optional(),
  postId: z.string().trim().max(100).nullable().optional(),
  active: z.boolean().default(true),
});

tagRulesRouter.get("/", async (req, res) => {
  res.json(
    await prisma.tagRule.findMany({
      where: { businessId: bid(req) },
      include: { tag: true },
      orderBy: { createdAt: "asc" },
    }),
  );
});

tagRulesRouter.post("/", async (req, res) => {
  const businessId = bid(req);
  const body = parse(RuleSchema, req.body);
  if (!(await prisma.tag.findFirst({ where: { id: body.tagId, businessId } }))) throw notFound("Tag not found");
  if (body.type === "KEYWORD" && !body.keywords.length) throw badRequest("Түлхүүр үг оруулна уу");
  if (body.type === "AI_INTENT") {
    if (!body.intent) throw badRequest("AI-д ойлгомжтой тайлбар бичнэ үү");
    const { plan } = await getPlanContext(businessId);
    if (!plan.features.aiTagging) throw planLimit("AI автомат tag Бизнес болон Про багцад байна");
  }
  res.status(201).json(await prisma.tagRule.create({ data: { businessId, ...body }, include: { tag: true } }));
});

tagRulesRouter.patch("/:id", async (req, res) => {
  const body = parse(RuleSchema.partial(), req.body);
  const rule = await prisma.tagRule.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!rule) throw notFound();
  res.json(await prisma.tagRule.update({ where: { id: rule.id }, data: body, include: { tag: true } }));
});

tagRulesRouter.delete("/:id", async (req, res) => {
  const r = await prisma.tagRule.deleteMany({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!r.count) throw notFound();
  res.json({ ok: true });
});
