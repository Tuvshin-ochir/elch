"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { ApiError, del, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx, dateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { Broadcast, SegmentFilters as SegmentFiltersT, Tag } from "@/lib/types";
import { SegmentFilters, segmentSummary } from "./SegmentFilters";

type BType = Broadcast["type"];
const TYPE_ICON: Record<BType, string> = { ONE_TIME: "📅", RECURRING: "🔁", TAG_TRIGGER: "⚡", INACTIVITY: "⏳" };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function NewBroadcast({ open, onClose, tags, onCreated }: { open: boolean; onClose: () => void; tags: Tag[]; onCreated: () => void }) {
  const { t } = useI18n();
  const B = t.dash.broadcasts;
  const { me } = useAuth();
  const sequencesAllowed = me?.subscription.planDef.features.sequences;
  const [f, setF] = useState(() => ({
    name: "",
    message: "",
    type: "ONE_TIME" as BType,
    tagIds: [] as string[],
    scheduledAt: toLocalInput(new Date(Date.now() + 3600_000)),
    recurrence: "WEEKLY",
    delay: 60,
    delayUnit: "minutes" as "minutes" | "hours",
    messageTag: "",
  }));
  const [filters, setFilters] = useState<SegmentFiltersT>({});
  const [showSeg, setShowSeg] = useState(false);
  const [audience, setAudience] = useState<{ total: number; inWindow: number; all: number } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Live audience size (debounced while typing ages)
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      post<{ total: number; inWindow: number; all: number }>("/broadcasts/audience", { tagIds: f.tagIds, filters }).then(setAudience).catch(() => undefined);
    }, 250);
    return () => clearTimeout(id);
  }, [open, f.tagIds, filters]);

  const timed = f.type === "ONE_TIME" || f.type === "RECURRING";

  async function submit() {
    setErr("");
    setBusy(true);
    try {
      await post("/broadcasts", {
        name: f.name || f.message.slice(0, 40),
        message: f.message,
        type: f.type,
        tagIds: f.tagIds,
        filters,
        scheduledAt: timed ? new Date(f.scheduledAt).toISOString() : null,
        recurrence: f.type === "RECURRING" ? f.recurrence : null,
        delayMinutes: timed ? null : f.delay * (f.delayUnit === "hours" ? 60 : 1),
        messageTag: f.messageTag || null,
      });
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={B.new} wide>
      <div className="space-y-5">
        <div>
          <Label>{B.type}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(B.types) as BType[]).map((type) => {
              const locked = (type === "TAG_TRIGGER" || type === "INACTIVITY") && !sequencesAllowed;
              return (
                <button
                  key={type}
                  onClick={() => setF({ ...f, type })}
                  className={cx(
                    "rounded-xl border p-3 text-left transition",
                    f.type === type ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-line hover:border-brand-300",
                  )}
                >
                  <div className="text-xl">{TYPE_ICON[type]}</div>
                  <p className="mt-1 text-sm font-semibold">{B.types[type]}</p>
                  <p className="mt-0.5 text-[11px] leading-tight text-muted">{B.typeHints[type]}</p>
                  {locked && <p className="mt-1 text-[11px] font-semibold text-amber-600">🔒 {B.proOnly}</p>}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>{B.audience}</Label>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setF({ ...f, tagIds: [] })}
              className={cx("rounded-full border px-3 py-1 text-xs font-medium", !f.tagIds.length ? "border-brand-500 bg-brand-600 text-white" : "border-line")}
            >
              {B.allContacts}
            </button>
            {tags.map((tg) => {
              const on = f.tagIds.includes(tg.id);
              return (
                <button
                  key={tg.id}
                  onClick={() => setF({ ...f, tagIds: on ? f.tagIds.filter((x) => x !== tg.id) : [...f.tagIds, tg.id] })}
                  className="rounded-full border px-3 py-1 text-xs font-medium transition"
                  style={on ? { backgroundColor: tg.color, borderColor: tg.color, color: "#fff" } : { borderColor: `${tg.color}55`, color: tg.color }}
                >
                  {tg.name}
                </button>
              );
            })}
          </div>
          <button type="button" onClick={() => setShowSeg(!showSeg)} className="mt-3 text-sm font-semibold text-brand-700 hover:underline">
            {showSeg ? `− ${B.segment.hide}` : `+ ${B.segment.show}`}
          </button>
          {showSeg && (
            <div className="mt-3">
              <SegmentFilters value={filters} onChange={setFilters} />
            </div>
          )}
          {audience && (
            <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
              👥 {B.audienceCount(audience.total, audience.inWindow)}
              {audience.total !== audience.all && <span className="ml-1 font-normal text-brand-700">· {B.segment.matching(audience.total, audience.all)}</span>}
            </p>
          )}
        </div>

        {timed ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <Label>{B.when}</Label>
              <Input type="datetime-local" value={f.scheduledAt} onChange={(e) => setF({ ...f, scheduledAt: e.target.value })} />
            </label>
            {f.type === "RECURRING" && (
              <label className="block">
                <Label>&nbsp;</Label>
                <Select value={f.recurrence} onChange={(e) => setF({ ...f, recurrence: e.target.value })}>
                  {(Object.keys(B.recurrence) as Array<keyof typeof B.recurrence>).map((r) => (
                    <option key={r} value={r}>
                      {B.recurrence[r]}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        ) : (
          <div>
            <Label>{B.delay}</Label>
            <div className="flex max-w-xs gap-2">
              <Input type="number" min={1} value={f.delay} onChange={(e) => setF({ ...f, delay: Number(e.target.value) })} />
              <Select value={f.delayUnit} onChange={(e) => setF({ ...f, delayUnit: e.target.value as "minutes" | "hours" })}>
                <option value="minutes">{B.minutes}</option>
                <option value="hours">{B.hours}</option>
              </Select>
            </div>
          </div>
        )}

        <label className="block">
          <Label hint={`— ${B.messageHint}`}>{B.message}</Label>
          <Textarea className="min-h-[110px]" value={f.message} maxLength={2000} onChange={(e) => setF({ ...f, message: e.target.value })} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <Label>{B.name}</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </label>
          <label className="block">
            <Label>{B.outside}</Label>
            <Select value={f.messageTag} onChange={(e) => setF({ ...f, messageTag: e.target.value })}>
              <option value="">{B.outsideNone}</option>
              {(Object.keys(B.outsideTags) as Array<keyof typeof B.outsideTags>).map((k) => (
                <option key={k} value={k}>
                  {B.outsideTags[k]}
                </option>
              ))}
            </Select>
          </label>
        </div>
        {f.messageTag && <Alert tone="warn" className="text-xs">⚠️ {B.outsideWarn}</Alert>}
        <p className="text-xs text-muted">ⓘ {t.automation.note}</p>

        {err && <Alert tone="error">{err}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button onClick={submit} loading={busy} disabled={!f.message.trim()}>
            {t.common.create}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function BroadcastsPage() {
  const { t, lang } = useI18n();
  const B = t.dash.broadcasts;
  const { refresh } = useAuth();
  const { data, reload } = useApi<Broadcast[]>("/broadcasts");
  const { data: tags } = useApi<Tag[]>("/tags");
  const [open, setOpen] = useState(false);

  // refresh counters while something is running
  useEffect(() => {
    const id = setInterval(reload, 15_000);
    return () => clearInterval(id);
  }, [reload]);

  const tagById = (id: string) => tags?.find((x) => x.id === id);

  return (
    <div>
      <PageHeader title={B.title} subtitle={B.subtitle} actions={<Button onClick={() => setOpen(true)}>+ {B.new}</Button>} />
      {!data ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon="⏰" title={B.empty} action={<Button onClick={() => setOpen(true)}>+ {B.new}</Button>} />
        </Card>
      ) : (
        <div className="space-y-3">
          {data.map((b) => (
            <Card key={b.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg">{TYPE_ICON[b.type]}</span>
                    <p className="font-semibold">{b.name}</p>
                    <Badge>{B.types[b.type]}</Badge>
                    <Badge
                      className={cx(
                        b.status === "ACTIVE" && "!bg-emerald-100 !text-emerald-700",
                        b.status === "PAUSED" && "!bg-amber-100 !text-amber-700",
                        b.status === "DONE" && "!bg-slate-200",
                      )}
                    >
                      {B.statuses[b.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{b.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {b.tagIds.length ? (
                      b.tagIds.map((id) => {
                        const tg = tagById(id);
                        return tg ? (
                          <Badge key={id} color={tg.color}>
                            {tg.name}
                          </Badge>
                        ) : null;
                      })
                    ) : (
                      <Badge>{B.allContacts}</Badge>
                    )}
                    {segmentSummary(b.filters, t).map((x) => (
                      <Badge key={x} className="!bg-amber-50 !text-amber-800">
                        🎯 {x}
                      </Badge>
                    ))}
                    <span className="ml-1">
                      {b.type === "RECURRING" && b.recurrence && `${B.recurrence[b.recurrence]} · `}
                      {b.nextRunAt && `${B.next}: ${dateTime(b.nextRunAt, lang)}`}
                      {b.delayMinutes &&
                        (b.delayMinutes % 60 === 0 ? ` +${b.delayMinutes / 60} ${B.hours}` : ` +${b.delayMinutes} ${B.minutes}`)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-slate-500">📊 {B.stats(b.sentCount, b.failedCount, b.skippedCount)}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {(b.type === "ONE_TIME" || b.type === "RECURRING") && b.status !== "DONE" && (
                    <Button size="sm" variant="secondary" onClick={() => post(`/broadcasts/${b.id}/run-now`).then(reload)}>
                      ▶ {B.runNow}
                    </Button>
                  )}
                  {b.status === "ACTIVE" && (
                    <Button size="sm" variant="outline" onClick={() => patch(`/broadcasts/${b.id}`, { status: "PAUSED" }).then(reload)}>
                      ⏸ {B.pause}
                    </Button>
                  )}
                  {b.status === "PAUSED" && (
                    <Button size="sm" variant="outline" onClick={() => patch(`/broadcasts/${b.id}`, { status: "ACTIVE" }).then(reload)}>
                      ▶ {B.resume}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => confirm(t.common.confirmDelete) && del(`/broadcasts/${b.id}`).then(reload)}>
                    ✕
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      <NewBroadcast
        open={open}
        onClose={() => setOpen(false)}
        tags={tags ?? []}
        onCreated={() => {
          reload();
          refresh();
        }}
      />
    </div>
  );
}
