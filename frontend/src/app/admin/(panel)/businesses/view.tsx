"use client";

import { useEffect, useMemo, useState } from "react";
import { BizLink, Pager, StatusBadge } from "@/components/admin/parts";
import { Alert, Card, EmptyState, Input, PageHeader, PlatformIcon, Select, Spinner } from "@/components/ui";
import { PLAN_LABEL, useAdminApi } from "@/lib/adminApi";
import { cx, date, money, timeAgo } from "@/lib/format";
import type { BusinessTypeDef } from "@/lib/types";
import { useApi } from "@/lib/useApi";

interface Row {
  id: string;
  name: string;
  businessType: string;
  createdAt: string;
  suspendedAt: string | null;
  owner: { name: string; email: string | null; phone: string | null; fbUserId: string | null; igUserId: string | null };
  subscription: { plan: string; status: string; currentPeriodEnd: string | null; autoRenew: boolean } | null;
  pages: Array<{ kind: "FACEBOOK_LOGIN" | "INSTAGRAM_LOGIN" | "INSTAGRAM_UNIFIED"; name: string; igUsername: string | null }>;
  _count: { contacts: number };
  active: boolean;
  aiRepliesMonth: number;
  paidTotal: number;
  lastActivityAt: string | null;
}

const FILTERS = [
  ["all", "Бүгд"],
  ["active", "Идэвхтэй"],
  ["expiring", "Дуусах дөхсөн"],
  ["past_due", "Төлбөр хоцорсон"],
  ["unpaid", "Төлөөгүй"],
  ["expired", "Дууссан"],
  ["suspended", "Түр хаасан"],
] as const;

export default function BusinessesView() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [plan, setPlan] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const path = `/businesses?${new URLSearchParams({ q: debounced, status, plan, page: String(page) })}`;
  const { data, error } = useAdminApi<{ total: number; page: number; pageSize: number; items: Row[] }>(path);
  const { data: types } = useApi<BusinessTypeDef[]>("/business-types");
  const typeLabel = useMemo(() => new Map((types ?? []).map((t) => [t.key, `${t.icon} ${t.label.mn}`])), [types]);

  return (
    <>
      <PageHeader title="Харилцагчид" subtitle={data ? `Нийт ${data.total} бизнес` : "Платформд бүртгүүлсэн бизнесүүд"} />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Нэр, имэйл, утас, пэйж, @instagram…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:max-w-sm" />
        <Select value={plan} onChange={(e) => { setPlan(e.target.value); setPage(1); }} className="sm:w-40">
          <option value="">Бүх багц</option>
          {Object.entries(PLAN_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>
      <div className="scrollbar-thin -mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map(([k, label]) => (
          <button
            key={k}
            onClick={() => { setStatus(k); setPage(1); }}
            className={cx(
              "shrink-0 rounded-full border px-3 py-1 text-sm font-medium transition",
              status === k ? "border-ink bg-ink text-white" : "border-line bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <Card className="overflow-hidden">
        {!data ? (
          <div className="flex justify-center py-16 text-brand-600">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon="🏪" title="Тохирох бизнес олдсонгүй" text="Шүүлтүүрээ өөрчилж үзнэ үү." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="bg-canvas text-left text-xs font-medium text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Бизнес</th>
                    <th className="px-3 py-2.5">Эзэмшигч</th>
                    <th className="px-3 py-2.5">Багц / төлөв</th>
                    <th className="px-3 py-2.5">Дуусах</th>
                    <th className="px-3 py-2.5 text-right">AI / сар</th>
                    <th className="px-3 py-2.5 text-right">Нийт төлсөн</th>
                    <th className="px-5 py-2.5">Сүүлд идэвхтэй</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((b) => (
                    <tr key={b.id} className="hover:bg-canvas/60">
                      <td className="px-5 py-3">
                        <BizLink id={b.id}>{b.name}</BizLink>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          <span>{typeLabel.get(b.businessType) ?? b.businessType}</span>
                          {b.pages.some((p) => p.kind === "FACEBOOK_LOGIN") && <PlatformIcon platform="FACEBOOK" className="h-3.5 w-3.5" />}
                          {b.pages.some((p) => p.igUsername) && <PlatformIcon platform="INSTAGRAM" className="h-3.5 w-3.5" />}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <p>{b.owner.name}</p>
                        <p className="text-xs text-muted">{b.owner.phone ?? b.owner.email ?? (b.owner.fbUserId ? "Facebook бүртгэл" : b.owner.igUserId ? "Instagram бүртгэл" : "—")}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="mb-1 text-xs font-medium">{b.subscription ? PLAN_LABEL[b.subscription.plan] : "—"}</p>
                        <StatusBadge status={b.subscription?.status ?? "INCOMPLETE"} active={b.active} suspended={!!b.suspendedAt} />
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {b.subscription?.currentPeriodEnd ? date(b.subscription.currentPeriodEnd) : "—"}
                        {b.subscription?.autoRenew && <p className="text-muted">автомат сунгалт</p>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{b.aiRepliesMonth.toLocaleString("en-US")}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{money(b.paidTotal)}</td>
                      <td className="px-5 py-3 text-xs text-muted">
                        {b.lastActivityAt ? timeAgo(b.lastActivityAt) : "—"}
                        <p>бүртг. {date(b.createdAt)}</p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </>
        )}
      </Card>
    </>
  );
}
