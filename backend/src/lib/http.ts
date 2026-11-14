import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, code?: string) => new HttpError(400, msg, code);
export const notFound = (msg = "Not found") => new HttpError(404, msg, "NOT_FOUND");
export const forbidden = (msg: string, code = "FORBIDDEN") => new HttpError(403, msg, code);
/** Plan limit / feature not in plan */
export const planLimit = (msg: string) => new HttpError(402, msg, "PLAN_LIMIT");

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, `${first.path.join(".") || "body"}: ${first.message}`, "VALIDATION");
  }
  return r.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input", code: "VALIDATION" });
  }
  console.error("[unhandled]", err);
  res.status(500).json({ error: "Internal server error" });
}

/** Express 5 forwards async errors automatically; this just narrows `req.params` typing. */
export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== "string") throw badRequest(`Missing param ${name}`);
  return v;
}
