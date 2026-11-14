"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Legend, LineChart } from "@/components/charts";
import { Panel, StatusBadge, shortDay } from "@/components/admin/parts";
import { Alert, Avatar, Badge, Button, Card, Input, Label, Modal, PlatformIcon, Progress, Select, Spinner, Textarea } from "@/components/ui";
import { apatch, apost, METHOD_LABEL, PAY_STATUS_LABEL, PLAN_LABEL, PLAN_PRICE, useAdminApi } from "@/lib/adminApi";
import { cx, date, dateTime, money, timeAgo } from "@/lib/format";
import type { BusinessTypeDef } from "@/lib/types";
import { useApi } from "@/lib/useApi";

interface Detail {
  id: string;
  name: string;
  businessType: string;
  createdAt: string;
  suspendedAt: string | null;
  suspendReason: string | null;
  adminNote: string | null;
  widgetEnabled: boolean;
  owner: { id: string; name: string; email: string | null; phone: string | null; fbUserId: string | null; igUserId: string | null; locale: string; createdAt: string; avatarUrl: string | null };
  pages: Array<{ id: string; kind: "FACEBOOK_LOGIN" | "INSTAGRAM_LOGIN" | "INSTAGRAM_UNIFIED"; name: string; igUsername: string | null; fbEnabled: boolean; igEnabled: boolean; commentAutoReply: boolean; lastSyncedAt: string | null; tokenExpiresAt: string | null; createdAt: string }>;
  payments: Array<{ id: string; plan: string; amount: number; method: string; status: string; isAutoCharge: boolean; failureReason: string | null; note: string | null; paidAt: string | null; createdAt: string; paymentMethod: { brand: string; last4: string } | null }>;
  _count: { contacts: number; messages: number; leads: number; knowledge: number; broadcasts: number; tags: number };
  subscription: {
    plan: string;
    status: string;
    active: boolean;
    currentPeriodEnd: string | null;
    autoRenew: boolean;
    pendingPlan: string | null;
    failedAttempts: number;
    defaultCard: { brand: string; last4: string } | null;
    usage: Record<"aiReplies" | "pages" | "knowledgeFiles" | "broadcasts", { used: number; limit: number | null }>;
  };
  paidTotal: number;
  lastActivityAt: string | null;
  series: Array<{ day: string; inbound: number; bot: number }>;
}

type ModalKind = null | "payment" | "extend" | "suspend" | "status";

export default function BusinessDetailView() {
  const { id } = useParams<{ id: string }>();
  const { data: b, error, reload } = useAdminApi<Detail>(`/businesses/${id}`);
  const { data: types } = useApi<BusinessTypeDef[]>("/business-types");
  const [modal, setModal] = useState<ModalKind>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const typeLabel = useMemo(() => {
    const t = types?.find((x) => x.key === b?.businessType);
    return t ? `${t.icon} ${t.label.mn}` : b?.businessType;
  }, [types, b?.businessType]);

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!b) {
    return (
      <div className="flex justify-center py-24 text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const s = b.subscription;
  const suspended = !!b.suspendedAt;
  const done = async (msg: string) => {
    setModal(null);
    setToast(msg);
    await reload();
  };

  return (
    <>
      <Link href="/admin/businesses" className="text-sm text-muted hover:text-ink">
        ← Харилцагчид
      </Link>
      <div className="mb-6 mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{b.name}</h1>
            <StatusBadge status={s.status} active={s.active} suspended={suspended} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {typeLabel} · бүртгүүлсэн {date(b.createdAt)} · сүүлд идэвхтэй {b.lastActivityAt ? timeAgo(b.lastActivityAt) : "—"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setModal("payment")}>+ Төлбөр бүртгэх</Button>
          <Button variant="outline" onClick={() => setModal("extend")}>
            Хугацаа сунгах
          </Button>
        </div>
      </div>

      {toast && (
        <Alert tone="success" className="mb-4">
          ✓ {toast}
        </Alert>
      )}
      {suspended && (
        <Alert tone="error" className="mb-4">
          <b>Түр хаасан</b> ({date(b.suspendedAt)}){b.suspendReason ? ` — ${b.suspendReason}` : ""}. Бот хариулахгүй, эзэмшигч нэвтэрч чадахгүй, картаас автоматаар татахгүй.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Owner */}
        <Panel title="Эзэмшигч">
          <div className="flex items-center gap-3">
            <Avatar src={b.owner.avatarUrl} name={b.owner.name} size={44} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{b.owner.name}</p>
              <p className="text-xs text-muted">
                {b.owner.fbUserId ? "Facebook-ээр" : b.owner.igUserId ? "Instagram-аар" : "Имэйлээр"} бүртгүүлсэн
              </p>
            </div>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Утас</dt>
              <dd>{b.owner.phone ? <a href={`tel:${b.owner.phone}`} className="font-medium text-brand-700 hover:underline">{b.owner.phone}</a> : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Имэйл</dt>
              <dd className="truncate">{b.owner.email ? <a href={`mailto:${b.owner.email}`} className="hover:underline">{b.owner.email}</a> : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Хэл</dt>
              <dd>{b.owner.locale === "en" ? "English" : "Монгол"}</dd>
            </div>
          </dl>
        </Panel>

        {/* Subscription */}
        <Panel
          title="Захиалга"
          right={
            <button onClick={() => setModal("status")} className="text-sm font-medium text-brand-700 hover:underline">
              Засах
            </button>
          }
        >
          <div className="flex items-baseline justify-between">
            <p className="text-xl font-bold">{PLAN_LABEL[s.plan]}</p>
            <p className="text-sm text-muted">{money(PLAN_PRICE[s.plan])}/сар</p>
          </div>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Дуусах</dt>
              <dd className="font-medium">{s.currentPeriodEnd ? date(s.currentPeriodEnd) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Автомат сунгалт</dt>
              <dd>{s.autoRenew ? `Асаалттай${s.defaultCard ? ` · •••• ${s.defaultCard.last4}` : ""}` : "Унтраалттай"}</dd>
            </div>
            {s.pendingPlan && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Дараагийн багц</dt>
                <dd>{PLAN_LABEL[s.pendingPlan]}</dd>
              </div>
            )}
            {s.failedAttempts > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Амжилтгүй татолт</dt>
                <dd className="text-red-600">{s.failedAttempts} удаа</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Нийт төлсөн</dt>
              <dd className="font-semibold">{money(b.paidTotal)}</dd>
            </div>
          </dl>
        </Panel>

        {/* Usage */}
        <Panel title="Хэрэглээ" hint="Одоогийн төлбөрийн хугацаанд">
          <div className="space-y-3 text-sm">
            {(
              [
                ["aiReplies", "AI хариулт"],
                ["pages", "Холболт"],
                ["knowledgeFiles", "Файл"],
                ["broadcasts", "Broadcast (сар)"],
              ] as const
            ).map(([key, label]) => {
              const u = s.usage[key];
              return (
                <div key={key}>
                  <div className="mb-1 flex justify-between">
                    <span className="text-muted">{label}</span>
                    <span className="tabular-nums">
                      {u.used.toLocaleString("en-US")} / {u.limit === null ? "∞" : u.limit.toLocaleString("en-US")}
                    </span>
                  </div>
                  <Progress value={u.used} max={u.limit} />
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Мессеж" hint="Сүүлийн 30 хоног" className="lg:col-span-2">
          <Legend
            series={[
              { key: "in", label: "Хэрэглэгчээс", color: "var(--color-series-1)" },
              { key: "bot", label: "AI хариулт", color: "var(--color-series-2)" },
            ]}
          />
          <div className="mt-3">
            <LineChart
              series={[
                { key: "in", label: "Хэрэглэгчээс", color: "var(--color-series-1)", values: b.series.map((d) => d.inbound) },
                { key: "bot", label: "AI хариулт", color: "var(--color-series-2)", values: b.series.map((d) => d.bot) },
              ]}
              labels={b.series.map((d) => d.day)}
              formatLabel={shortDay}
              height={180}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center sm:grid-cols-6">
            {(
              [
                ["Хэрэглэгч", b._count.contacts],
                ["Мессеж", b._count.messages],
                ["Захиалга", b._count.leads],
                ["Мэдлэг", b._count.knowledge],
                ["Broadcast", b._count.broadcasts],
                ["Tag", b._count.tags],
              ] as const
            ).map(([label, n]) => (
              <div key={label} className="rounded-xl bg-canvas px-2 py-2">
                <p className="font-semibold tabular-nums">{n.toLocaleString("en-US")}</p>
                <p className="text-xs text-muted">{label}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Сувгууд">
          {b.pages.length === 0 && !b.widgetEnabled ? (
            <p className="text-sm text-muted">Одоогоор суваг холбоогүй.</p>
          ) : (
            <div className="space-y-3">
              {b.pages.map((p) => (
                <div key={p.id} className="rounded-xl bg-canvas px-3 py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <PlatformIcon platform={p.kind === "FACEBOOK_LOGIN" ? "FACEBOOK" : "INSTAGRAM"} className="h-4 w-4" />
                    <span className="truncate font-medium">{p.name}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {p.kind === "FACEBOOK_LOGIN" && <Badge className={p.fbEnabled ? "bg-brand-50 text-brand-700" : ""}>Messenger {p.fbEnabled ? "асаалттай" : "унтраалттай"}</Badge>}
                    {p.igUsername && <Badge className={p.igEnabled ? "bg-brand-50 text-brand-700" : ""}>@{p.igUsername} {p.igEnabled ? "асаалттай" : "унтраалттай"}</Badge>}
                    {p.commentAutoReply && <Badge>Коммент</Badge>}
                  </div>
                  {p.tokenExpiresAt && <p className="mt-1 text-xs text-muted">Token дуусах: {date(p.tokenExpiresAt)}</p>}
                </div>
              ))}
              {b.widgetEnabled && (
                <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm">
                  <PlatformIcon platform="WEB" className="h-4 w-4" />
                  <span className="font-medium">Вэбсайт чат</span>
                </div>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Card className="mt-4 overflow-hidden">
        <h2 className="px-5 pb-3 pt-5 font-semibold">Төлбөрийн түүх</h2>
        {b.payments.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted">Төлбөр алга.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-canvas text-left text-xs font-medium text-muted">
                <tr>
                  <th className="px-5 py-2.5">Огноо</th>
                  <th className="px-3 py-2.5">Багц</th>
                  <th className="px-3 py-2.5">Арга</th>
                  <th className="px-3 py-2.5 text-right">Дүн</th>
                  <th className="px-5 py-2.5">Төлөв</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {b.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-5 py-2.5 text-muted">{dateTime(p.paidAt ?? p.createdAt)}</td>
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
        )}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <NotePanel id={b.id} initial={b.adminNote ?? ""} onSaved={() => setToast("Тэмдэглэл хадгалагдлаа")} />
        <Panel title={suspended ? "Бүртгэлийг сэргээх" : "Түр хаах"} hint={suspended ? "Бот дахин ажиллаж, эзэмшигч нэвтэрч чадна" : "Бот зогсож, нэвтрэх эрх болон автомат төлбөр хаагдана. Өгөгдөл устахгүй."}>
          {suspended ? (
            <UnsuspendButton id={b.id} onDone={() => done("Бүртгэл сэргээгдлээ")} />
          ) : (
            <Button variant="danger" onClick={() => setModal("suspend")}>
              Түр хаах…
            </Button>
          )}
        </Panel>
      </div>

      <PaymentModal open={modal === "payment"} onClose={() => setModal(null)} id={b.id} currentPlan={s.plan} onDone={() => done("Төлбөр бүртгэгдэж, багц идэвхжлээ")} />
      <ExtendModal open={modal === "extend"} onClose={() => setModal(null)} id={b.id} currentEnd={s.currentPeriodEnd} onDone={(d) => done(`${d} хоногоор сунгалаа`)} />
      <SuspendModal open={modal === "suspend"} onClose={() => setModal(null)} id={b.id} onDone={() => done("Бүртгэлийг түр хаалаа")} />
      {/* mounted only while open so the form starts from the latest subscription */}
      {modal === "status" && <StatusModal open onClose={() => setModal(null)} id={b.id} sub={s} onDone={() => done("Захиалга шинэчлэгдлээ")} />}
    </>
  );
}

// ───────── Pieces ─────────

function useAction() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      after();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Алдаа гарлаа");
    } finally {
      setBusy(false);
    }
  };
  return { busy, err, run };
}

function NotePanel({ id, initial, onSaved }: { id: string; initial: string; onSaved: () => void }) {
  const [note, setNote] = useState(initial);
  const { busy, err, run } = useAction();
  return (
    <Panel title="Дотоод тэмдэглэл" hint="Зөвхөн админд харагдана — ярьсан зүйл, тохиролцоо гэх мэт">
      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Жишээ нь: 11/14 утсаар ярьсан, дараа сард Про руу шилжинэ." rows={4} />
      <Button className="mt-3" variant="secondary" loading={busy} disabled={note === initial} onClick={() => run(() => apatch(`/businesses/${id}`, { adminNote: note }), onSaved)}>
        Хадгалах
      </Button>
    </Panel>
  );
}

function UnsuspendButton({ id, onDone }: { id: string; onDone: () => void }) {
  const { busy, err, run } = useAction();
  return (
    <>
      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      <Button loading={busy} onClick={() => run(() => apatch(`/businesses/${id}`, { suspended: false }), onDone)}>
        Сэргээх
      </Button>
    </>
  );
}

function PaymentModal({ open, onClose, id, currentPlan, onDone }: { open: boolean; onClose: () => void; id: string; currentPlan: string; onDone: () => void }) {
  const [plan, setPlan] = useState(currentPlan);
  const [months, setMonths] = useState(1);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState("");
  const { busy, err, run } = useAction();
  const suggested = PLAN_PRICE[plan] * months;

  return (
    <Modal open={open} onClose={onClose} title="Төлбөр бүртгэх">
      <p className="mb-4 text-sm text-muted">Дансаар шилжүүлсэн эсвэл бэлнээр авсан төлбөрийг бүртгэнэ. Бүртгэмэгц багц идэвхжиж, хугацаа нэмэгдэнэ.</p>
      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <label>
          <Label>Багц</Label>
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            {Object.entries(PLAN_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v} — {money(PLAN_PRICE[k])}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <Label>Хэдэн сар</Label>
          <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 2, 3, 6, 12].map((m) => (
              <option key={m} value={m}>
                {m} сар
              </option>
            ))}
          </Select>
        </label>
      </div>
      <label className="mt-3 block">
        <Label hint={`(санал: ${money(suggested)})`}>Хүлээн авсан дүн ₮</Label>
        <Input inputMode="numeric" placeholder={String(suggested)} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} />
      </label>
      <label className="mt-3 block">
        <Label hint="(заавал биш)">Тэмдэглэл</Label>
        <Input placeholder="Гүйлгээний утга, банк…" value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Болих
        </Button>
        <Button
          loading={busy}
          onClick={() =>
            run(
              () => apost(`/businesses/${id}/payments`, { plan, months, amount: amount ? Number(amount) : undefined, note: note || undefined }),
              () => {
                setAmount("");
                setNote("");
                onDone();
              },
            )
          }
        >
          {money(amount ? Number(amount) : suggested)} бүртгэх
        </Button>
      </div>
    </Modal>
  );
}

function ExtendModal({ open, onClose, id, currentEnd, onDone }: { open: boolean; onClose: () => void; id: string; currentEnd: string | null; onDone: (days: number) => void }) {
  const [days, setDays] = useState(7);
  const { busy, err, run } = useAction();
  const base = currentEnd && new Date(currentEnd) > new Date() ? new Date(currentEnd) : new Date();
  const newEnd = new Date(base.getTime() + days * 86_400_000);
  return (
    <Modal open={open} onClose={onClose} title="Хугацаа сунгах (үнэгүй)">
      <p className="mb-4 text-sm text-muted">Төлбөргүйгээр хоног нэмнэ: техникийн асуудлын нөхөн олговор, урамшуулал гэх мэт. Захиалга идэвхжинэ.</p>
      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      <div className="flex flex-wrap gap-2">
        {[3, 7, 14, 30].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={cx("rounded-full border px-3 py-1 text-sm font-medium", days === d ? "border-brand-600 bg-brand-50 text-brand-700" : "border-line")}>
            {d} хоног
          </button>
        ))}
      </div>
      <label className="mt-3 block">
        <Label>Хоног</Label>
        <Input type="number" min={1} max={366} value={days} onChange={(e) => setDays(Math.max(1, Math.min(366, Number(e.target.value) || 1)))} />
      </label>
      <p className="mt-3 text-sm">
        Шинэ дуусах огноо: <b>{date(newEnd)}</b>
      </p>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Болих
        </Button>
        <Button loading={busy} onClick={() => run(() => apost(`/businesses/${id}/extend`, { days }), () => onDone(days))}>
          Сунгах
        </Button>
      </div>
    </Modal>
  );
}

function SuspendModal({ open, onClose, id, onDone }: { open: boolean; onClose: () => void; id: string; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const { busy, err, run } = useAction();
  return (
    <Modal open={open} onClose={onClose} title="Бүртгэлийг түр хаах">
      <p className="mb-4 text-sm text-muted">Бот бүх сувгаар хариулахаа зогсооно. Эзэмшигч нэвтрэхэд доорх шалтгаан харагдана. Хэзээ ч сэргээж болно.</p>
      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      <label className="block">
        <Label hint="(эзэмшигчид харагдана)">Шалтгаан</Label>
        <Input placeholder="Жишээ нь: үйлчилгээний нөхцөл зөрчсөн" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Болих
        </Button>
        <Button variant="danger" loading={busy} onClick={() => run(() => apatch(`/businesses/${id}`, { suspended: true, suspendReason: reason || null }), onDone)}>
          Түр хаах
        </Button>
      </div>
    </Modal>
  );
}

function StatusModal({ open, onClose, id, sub, onDone }: { open: boolean; onClose: () => void; id: string; sub: Detail["subscription"]; onDone: () => void }) {
  const [plan, setPlan] = useState(sub.plan);
  const [status, setStatus] = useState(sub.status);
  const [end, setEnd] = useState(sub.currentPeriodEnd ? sub.currentPeriodEnd.slice(0, 10) : "");
  const [autoRenew, setAutoRenew] = useState(sub.autoRenew);
  const { busy, err, run } = useAction();

  return (
    <Modal open={open} onClose={onClose} title="Захиалга засах">
      <p className="mb-4 text-sm text-muted">Гараар засна. Төлбөр бүртгэх бол «Төлбөр бүртгэх»-ийг ашиглана уу — орлогод тооцогдоно.</p>
      {err && <Alert tone="error" className="mb-3">{err}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <label>
          <Label>Багц</Label>
          <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
            {Object.entries(PLAN_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <Label>Төлөв</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Идэвхтэй</option>
            <option value="PAST_DUE">Төлбөр хоцорсон</option>
            <option value="INCOMPLETE">Төлөөгүй</option>
            <option value="EXPIRED">Хугацаа дууссан</option>
            <option value="CANCELED">Цуцалсан</option>
          </Select>
        </label>
      </div>
      <label className="mt-3 block">
        <Label>Дуусах огноо</Label>
        <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={autoRenew} onChange={(e) => setAutoRenew(e.target.checked)} className="h-4 w-4 accent-brand-600" />
        Картаас сар бүр автоматаар татах
      </label>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Болих
        </Button>
        <Button
          loading={busy}
          onClick={() =>
            run(
              () =>
                apatch(`/businesses/${id}/subscription`, {
                  plan,
                  status,
                  autoRenew,
                  // end of the chosen day, Ulaanbaatar time
                  currentPeriodEnd: end ? `${end}T23:59:59+08:00` : null,
                }),
              onDone,
            )
          }
        >
          Хадгалах
        </Button>
      </div>
    </Modal>
  );
}
