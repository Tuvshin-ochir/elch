"use client";

import { useCallback, useEffect, useState } from "react";
import { API_URL, ApiError } from "./api";

/** Platform-admin session — kept apart from the business-owner token so both can be open at once. */
const KEY = "elch_admin_token";

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode */
  }
}

export async function adminApi<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAdminToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  let body = init.body;
  if (init.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(init.json);
  }
  const res = await fetch(`${API_URL}/api/admin${path}`, { ...init, headers, body });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== "/login" && typeof window !== "undefined") {
      setAdminToken(null);
      window.location.replace("/admin/login");
    }
    throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status, (data as { code?: string }).code);
  }
  return data as T;
}

export const aget = <T,>(path: string) => adminApi<T>(path);
export const apost = <T,>(path: string, json?: unknown) => adminApi<T>(path, { method: "POST", json: json ?? {} });
export const apatch = <T,>(path: string, json: unknown) => adminApi<T>(path, { method: "PATCH", json });

export function useAdminApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!path) return;
    try {
      setData(await aget<T>(path));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }, [path]);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    aget<T>(path)
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Error"));
    return () => {
      alive = false;
    };
  }, [path]);

  return { data, error, loading: data === null && error === null, reload };
}

// ───────── Shared admin labels ─────────

export const PLAN_LABEL: Record<string, string> = { STARTER: "Старт", BUSINESS: "Бизнес", PRO: "Про" };
export const PLAN_PRICE: Record<string, number> = { STARTER: 99_000, BUSINESS: 149_000, PRO: 199_000 };

export const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Идэвхтэй",
  PAST_DUE: "Төлбөр хоцорсон",
  INCOMPLETE: "Төлөөгүй",
  EXPIRED: "Хугацаа дууссан",
  CANCELED: "Цуцалсан",
};

export const PAY_STATUS_LABEL: Record<string, string> = { PENDING: "Хүлээгдэж буй", PAID: "Төлсөн", FAILED: "Амжилтгүй", CANCELED: "Цуцлагдсан" };
export const METHOD_LABEL: Record<string, string> = { QPAY: "QPay", CARD: "Карт", MANUAL: "Дансаар / бэлнээр" };

/** Badge tone for a customer's state. Suspended wins over subscription status. */
export function statusTone(status: string, active: boolean, suspended: boolean): { label: string; className: string } {
  if (suspended) return { label: "Түр хаасан", className: "bg-slate-800 text-white" };
  if (status === "ACTIVE" && !active) return { label: "Хугацаа дууссан", className: "bg-red-50 text-red-700" };
  switch (status) {
    case "ACTIVE":
      return { label: STATUS_LABEL.ACTIVE, className: "bg-brand-50 text-brand-700" };
    case "PAST_DUE":
      return { label: STATUS_LABEL.PAST_DUE, className: "bg-amber-50 text-amber-800" };
    case "INCOMPLETE":
      return { label: STATUS_LABEL.INCOMPLETE, className: "bg-slate-100 text-slate-700" };
    default:
      return { label: STATUS_LABEL[status] ?? status, className: "bg-red-50 text-red-700" };
  }
}
