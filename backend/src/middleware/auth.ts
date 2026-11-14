import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.ts";
import { HttpError } from "../lib/http.ts";
import { prisma } from "../lib/prisma.ts";

export interface AuthPayload {
  uid: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      businessId?: string;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ uid: userId } satisfies AuthPayload, config.jwtSecret, { expiresIn: "30d" });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies?.token;
  if (!token) throw new HttpError(401, "Нэвтрэх шаардлагатай", "UNAUTHORIZED");
  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
  } catch {
    throw new HttpError(401, "Session expired", "UNAUTHORIZED");
  }
  const business = await prisma.business.findUnique({
    where: { ownerId: payload.uid },
    select: { id: true, suspendedAt: true, suspendReason: true },
  });
  if (!business) throw new HttpError(401, "Account not found", "UNAUTHORIZED");
  if (business.suspendedAt) {
    throw new HttpError(403, `Таны бүртгэл түр хаагдсан${business.suspendReason ? `: ${business.suspendReason}` : ""}. Бидэнтэй холбогдоно уу.`, "SUSPENDED");
  }
  req.userId = payload.uid;
  req.businessId = business.id;
  next();
}

export function bid(req: Request): string {
  if (!req.businessId) throw new HttpError(401, "Unauthorized", "UNAUTHORIZED");
  return req.businessId;
}
