import { Router } from "express";
import { z } from "zod";
import { notFound, param, parse } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";
import { bid, requireAuth } from "../middleware/auth.ts";

export const leadsRouter = Router();
leadsRouter.use(requireAuth);

leadsRouter.get("/", async (req, res) => {
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  res.json(
    await prisma.lead.findMany({
      where: {
        businessId: bid(req),
        ...(status ? { status: status as "NEW" } : {}),
        contact: { NOT: { externalId: { startsWith: "playground:" } } },
      },
      include: { contact: { select: { id: true, name: true, platform: true, profilePic: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  );
});

leadsRouter.patch("/:id", async (req, res) => {
  const body = parse(
    z.object({ status: z.enum(["NEW", "CONTACTED", "DONE", "CANCELED"]).optional(), details: z.string().max(5000).optional() }),
    req.body,
  );
  const lead = await prisma.lead.findFirst({ where: { id: param(req, "id"), businessId: bid(req) } });
  if (!lead) throw notFound();
  res.json(await prisma.lead.update({ where: { id: lead.id }, data: body }));
});
