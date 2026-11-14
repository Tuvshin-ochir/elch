"use client";

import type { ReactNode } from "react";
import { cx, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { PlanDef } from "@/lib/types";

export function PlanFeatures({ plan }: { plan: PlanDef }) {
  const { t } = useI18n();
  const p = t.pricing;
  const rows: Array<[string, boolean]> = [
    [p.pages(plan.limits.pages), true],
    [p.aiReplies(plan.limits.aiReplies), true],
    [p.files(plan.limits.knowledgeFiles), true],
    [p.broadcasts(plan.limits.broadcastsPerMonth), true],
    [p.f.basics, true],
    [p.f.pageSync, true],
    [p.f.leadCapture, plan.features.leadCapture],
    [p.f.inbox, true],
    [p.f.website, true],
    [p.f.analytics, true],
    [p.f.manualTags, true],
    [p.f.aiTagging, plan.features.aiTagging],
    [p.f.commentAutoReply, plan.features.commentAutoReply],
    [p.f.imageUnderstanding, plan.features.imageUnderstanding],
    [p.f.sequences, plan.features.sequences],
  ];
  return (
    <ul className="space-y-2.5 text-sm">
      {rows.map(([label, on]) => (
        <li key={label} className={cx("flex items-start gap-2", !on && "text-slate-400 line-through decoration-slate-300")}>
          <span className={cx("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]", on ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400")}>
            {on ? "✓" : "–"}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

export function PlanCard({ plan, highlight, action, badge }: { plan: PlanDef; highlight?: boolean; action: ReactNode; badge?: ReactNode }) {
  const { t, l, lang } = useI18n();
  return (
    <div
      className={cx(
        "relative flex flex-col rounded-3xl border bg-white p-6 sm:p-7",
        highlight ? "border-brand-500 shadow-xl shadow-brand-500/15 ring-1 ring-brand-500" : "border-line shadow-sm",
      )}
    >
      {badge && <div className="absolute -top-3 left-1/2 -translate-x-1/2">{badge}</div>}
      <h3 className="text-lg font-bold">{l(plan.name)}</h3>
      <p className="mt-1 min-h-10 text-sm text-muted">{t.pricing.desc[plan.code]}</p>
      <div className="mt-5 flex items-end gap-1">
        <span className="text-4xl font-extrabold tracking-tight">{money(plan.price, lang)}</span>
        <span className="mb-1 text-sm text-muted">{t.common.perMonth}</span>
      </div>
      <div className="mt-6">{action}</div>
      <div className="mt-6 border-t border-line pt-6">
        <PlanFeatures plan={plan} />
      </div>
    </div>
  );
}
