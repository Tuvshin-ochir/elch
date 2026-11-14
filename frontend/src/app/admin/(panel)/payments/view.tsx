"use client";

import { useEffect, useState } from "react";
import { BizLink, Pager } from "@/components/admin/parts";
import { Alert, Card, EmptyState, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { METHOD_LABEL, PAY_STATUS_LABEL, PLAN_LABEL, useAdminApi } from "@/lib/adminApi";
import { cx, dateTime, money } from "@/lib/format";

interface PaymentRow {
  id: string;
  plan: string;
  amount: number;
  method: string;
  status: string;
  isAutoCharge: boolean;
  failureReason: string | null;
  note: string | null;
  paidAt: string | null;
  createdAt: string;
  paymentMethod: { brand: string; last4: string } | null;
  business: { id: string; name: string };
}

interface Resp {
  total: number;
  page: number;
  pageSize: number;
  items: PaymentRow[];
  paidByMethod: Record<string, { amount: number; count: number }>;
}

export default function PaymentsView() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("PAID");
  const [method, setMethod] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, error } = useAdminApi<Resp>(`/payments?${new URLSearchParams({ q: debounced, status, method, page: String(page) })}`);
  const totals = data ? Object.values(data.paidByMethod).reduce((a, x) => ({ amount: a.amount + x.amount, count: a.count + x.count }), { amount: 0, count: 0 }) : null;

  return (
    <>
      <PageHeader title="Төлбөрүүд" subtitle="QPay, карт болон гараар бүртгэсэн бүх төлбөр" />

      {data && totals && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
            <p className="text-xs text-muted">Төлөгдсөн нийт (шүүлтээр)</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{money(totals.amount)}</p>
            <p className="text-xs text-muted">{totals.count} гүйлгээ</p>
          </div>
          {(["QPAY", "CARD", "MANUAL"] as const).map((m) => (
            <div key={m} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
              <p className="text-xs text-muted">{METHOD_LABEL[m]}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{money(data.paidByMethod[m]?.amount ?? 0)}</p>
              <p className="text-xs text-muted">{data.paidByMethod[m]?.count ?? 0} гүйлгээ</p>
            </div>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <Input placeholder="Бизнесийн нэрээр хайх…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} className="sm:max-w-xs" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">Бүх төлөв</option>
          {Object.entries(PAY_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">Бүх арга</option>
          {Object.entries(METHOD_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      {error && <Alert tone="error">{error}</Alert>}
      <Card className="overflow-hidden">
        {!data ? (
          <div className="flex justify-center py-16 text-brand-600">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon="💳" title="Төлбөр олдсонгүй" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-canvas text-left text-xs font-medium text-muted">
                  <tr>
                    <th className="px-5 py-2.5">Огноо</th>
                    <th className="px-3 py-2.5">Бизнес</th>
                    <th className="px-3 py-2.5">Багц</th>
                    <th className="px-3 py-2.5">Арга</th>
                    <th className="px-3 py-2.5 text-right">Дүн</th>
                    <th className="px-5 py-2.5">Төлөв</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {data.items.map((p) => (
                    <tr key={p.id}>
                      <td className="px-5 py-2.5 text-muted">{dateTime(p.paidAt ?? p.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <BizLink id={p.business.id}>{p.business.name}</BizLink>
                      </td>
                      <td className="px-3 py-2.5">{PLAN_LABEL[p.plan]}</td>
                      <td className="px-3 py-2.5">
                        {p.method === "CARD" && p.paymentMethod ? `Карт •••• ${p.paymentMethod.last4}` : METHOD_LABEL[p.method]}
                        {p.isAutoCharge && <span className="ml-1 text-xs text-muted">(автомат)</span>}
                        {p.note && <p className="text-xs text-muted">{p.note}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{money(p.amount)}</td>
                      <td className="px-5 py-2.5">
                        <span className={cx("text-xs font-medium", p.status === "PAID" ? "text-brand-700" : p.status === "FAILED" ? "text-red-600" : "text-muted")}>
                          {PAY_STATUS_LABEL[p.status]}
                        </span>
                        {p.failureReason && <p className="text-xs text-muted">{p.failureReason}</p>}
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
