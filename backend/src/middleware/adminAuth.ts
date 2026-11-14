import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.ts";
import { HttpError } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";

/**
 * Platform-admin sessions (/admin). Signed with a key derived from JWT_SECRET so an admin
 * token can never pass as a business-owner token and vice versa.
 */
const ADMIN_SECRET = `${config.jwtSecret}::admin`;

interface AdminPayload {
  aid: string;
  typ: "admin";
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      adminId?: string;
    }
  }
}

export function signAdminToken(adminId: string): string {
  return jwt.sign({ aid: adminId, typ: "admin" } satisfies AdminPayload, ADMIN_SECRET, { expiresIn: "12h" });
}

export async function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) throw new HttpError(401, "Админ эрхээр нэвтэрнэ үү", "UNAUTHORIZED");
  let payload: AdminPayload;
  try {
    payload = jwt.verify(token, ADMIN_SECRET) as AdminPayload;
  } catch {
    throw new HttpError(401, "Session expired", "UNAUTHORIZED");
  }
  if (payload.typ !== "admin" || !payload.aid) throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
  const admin = await prisma.admin.findUnique({ where: { id: payload.aid }, select: { id: true } });
  if (!admin) throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
  req.adminId = admin.id;
  next();
}
