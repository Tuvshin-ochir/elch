"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { statusTone } from "@/lib/adminApi";
import { cx } from "@/lib/format";

export function Panel({ title, hint, right, children, className }: { title: string; hint?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cx("p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export function StatusBadge({ status, active, suspended }: { status: string; active: boolean; suspended: boolean }) {
  const t = statusTone(status, active, suspended);
  return <span className={cx("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", t.className)}>{t.label}</span>;
}

export function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
      <span className="text-muted">
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} / {total}
      </span>
      <div className="flex gap-2">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-line px-3 py-1 disabled:opacity-40">
          ← Өмнөх
        </button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-line px-3 py-1 disabled:opacity-40">
          Дараах →
        </button>
      </div>
    </div>
  );
}

export function BizLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <Link href={`/admin/businesses/${id}`} className="font-medium text-ink hover:text-brand-700 hover:underline">
      {children}
    </Link>
  );
}

/** Short Ulaanbaatar-style day label for chart axes: 2026-11-07 → 11.07 */
export const shortDay = (d: string) => d.slice(5).replace("-", ".");
