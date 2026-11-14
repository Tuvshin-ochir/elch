"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Badge, Card, EmptyState, PageHeader, Select, Spinner } from "@/components/ui";
import { patch } from "@/lib/api";
import { cx, dateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { Lead } from "@/lib/types";

const STATUS_STYLE: Record<Lead["status"], string> = {
  NEW: "!bg-brand-100 !text-brand-700",
  CONTACTED: "!bg-amber-100 !text-amber-700",
  DONE: "!bg-emerald-100 !text-emerald-700",
  CANCELED: "!bg-slate-200 !text-slate-600",
};

export default function LeadsPage() {
  const { t, lang } = useI18n();
  const L = t.dash.leads;
  const [status, setStatus] = useState("");
  const { data, reload } = useApi<Lead[]>(`/leads${status ? `?status=${status}` : ""}`);

  return (
    <div>
      <PageHeader
        title={L.title}
        subtitle={L.subtitle}
        actions={
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-44">
            <option value="">{t.common.all}</option>
            {(Object.keys(L.statuses) as Lead["status"][]).map((s) => (
              <option key={s} value={s}>
                {L.statuses[s]}
              </option>
            ))}
          </Select>
        }
      />
      {!data ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon="🧾" title={L.empty} />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((l) => (
            <Card key={l.id} className="flex flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <Badge className={cx(l.type === "ORDER" ? "!bg-emerald-100 !text-emerald-700" : l.type === "BOOKING" ? "!bg-violet-100 !text-violet-700" : "")}>
                  {L.types[l.type]}
                </Badge>
                <span className="text-xs text-muted">{dateTime(l.createdAt, lang)}</span>
              </div>
              <p className="mt-3 flex-1 whitespace-pre-wrap text-sm">{l.details}</p>
              <div className="mt-4 flex items-center gap-2.5 border-t border-line pt-3">
                <Avatar src={l.contact?.profilePic} name={l.name ?? l.contact?.name} size={30} />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{l.name ?? l.contact?.name ?? "—"}</p>
                  <p className="text-xs text-muted">{l.phone ?? l.contact?.phone ?? ""}</p>
                </div>
                {l.contact && (
                  <Link href={`/dashboard/inbox?contact=${l.contact.id}`} className="text-xs font-semibold text-brand-600 hover:underline">
                    {L.openChat}
                  </Link>
                )}
              </div>
              <Select
                className={cx("mt-3 !h-9 text-xs font-semibold", STATUS_STYLE[l.status])}
                value={l.status}
                onChange={(e) => patch(`/leads/${l.id}`, { status: e.target.value }).then(reload)}
              >
                {(Object.keys(L.statuses) as Lead["status"][]).map((s) => (
                  <option key={s} value={s}>
                    {L.statuses[s]}
                  </option>
                ))}
              </Select>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
