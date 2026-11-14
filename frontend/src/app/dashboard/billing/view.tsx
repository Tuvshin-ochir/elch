"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { PlanFeatures } from "@/components/PlanCard";
import { Alert, Badge, Button, Card, Modal, PageHeader, Spinner, Toggle } from "@/components/ui";
import { ApiError, del, get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx, date, dateTime, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import { useApi } from "@/lib/useApi";
import type { PlanCode, SubscriptionSummary } from "@/lib/types";

interface BillingData {
  subscription: SubscriptionSummary;
  cards: Array<{ id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean; provider: string }>;
  payments: Array<{
    id: string;
    plan: PlanCode;
    amount: number;
    method: "QPAY" | "CARD" | "MANUAL";
    status: "PENDING" | "PAID" | "FAILED" | "CANCELED";
    isAutoCharge: boolean;
    failureReason: string | null;
    paidAt: string | null;
    createdAt: string;
    paymentMethod: { brand: string; last4: string } | null;
  }>;
  qpayMock: boolean;
  /** which online payment methods work; none → bank transfer, activated by an admin */
  paymentOptions: { qpay: boolean; card: boolean; manualNote: string };
}

interface QPayInvoice {
  id: string;
  plan: PlanCode;
  amount: number;
  status: string;
  qrImage: string | null;
  qrText: string | null;
  deeplinks: Array<{ name: string; description?: string; logo?: string; link: string }>;
  mock: boolean;
}

function QPayModal({ plan, onClose, onPaid }: { plan: PlanCode; onClose: () => void; onPaid: () => void }) {
  const { t, lang } = useI18n();
  const b = t.dash.billing;
  const [inv, setInv] = useState<QPayInvoice | null>(null);
  const [paid, setPaid] = useState(false);
  const [err, setErr] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    post<QPayInvoice>("/billing/qpay", { plan })
      .then(setInv)
      .catch((e) => setErr(e.message));
  }, [plan]);

  useEffect(() => {
    if (!inv || paid) return;
    timer.current = setInterval(async () => {
      const r = await get<{ status: string }>(`/billing/payments/${inv.id}`).catch(() => null);
      if (r?.status === "PAID") {
        setPaid(true);
        onPaid();
      }
    }, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [inv, paid, onPaid]);

  async function simulate() {
    if (!inv) return;
    await post(`/billing/qpay/${inv.id}/simulate`);
    setPaid(true);
    onPaid();
  }

  return (
    <Modal open onClose={onClose} title={b.qpayTitle}>
      {err && <Alert tone="error">{err}</Alert>}
      {!inv && !err && (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner />
        </div>
      )}
      {inv && paid && (
        <div className="py-8 text-center">
          <div className="text-5xl">🎉</div>
          <p className="mt-4 font-semibold">{b.qpayPaid}</p>
          <Button className="mt-6" onClick={onClose}>
            {t.common.close}
          </Button>
        </div>
      )}
      {inv && !paid && (
        <div className="text-center">
          <p className="text-sm text-muted">{b.qpayScan}</p>
          <p className="mt-1 text-2xl font-bold">{money(inv.amount, lang)}</p>
          {inv.qrImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`data:image/png;base64,${inv.qrImage}`} alt="QPay QR" className="mx-auto mt-4 h-60 w-60 rounded-2xl border border-line p-2" />
          )}
          <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner className="h-4 w-4" /> {b.qpayWaiting}
          </p>
          {inv.deeplinks.length > 0 && (
            <div className="mt-5 grid grid-cols-3 gap-2 sm:hidden">
              {inv.deeplinks.map((d) => (
                <a key={d.name} href={d.link} className="flex flex-col items-center gap-1 rounded-xl border border-line p-2 text-[11px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {d.logo && <img src={d.logo} alt="" className="h-8 w-8 rounded-lg" />}
                  <span className="line-clamp-1">{d.description ?? d.name}</span>
                </a>
              ))}
            </div>
          )}
          {inv.mock && (
            <div className="mt-5">
              <Alert tone="warn" className="text-left text-xs">
                {b.qpayMock}
              </Alert>
              <Button variant="secondary" className="mt-3" onClick={simulate}>
                {b.simulate}
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function BillingInner() {
  const { t, l, lang } = useI18n();
  const b = t.dash.billing;
  const { me, refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const { data, reload } = useApi<BillingData>("/billing");
  const [qpayPlan, setQpayPlan] = useState<PlanCode | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const cardResult = params.get("card") as keyof typeof b.cardResult | null;
  const [msg, setMsg] = useState<{ tone: "success" | "error" | "warn"; text: string } | null>(() =>
    cardResult && b.cardResult[cardResult]
      ? { tone: cardResult === "paid" || cardResult === "card_saved" ? "success" : "warn", text: b.cardResult[cardResult] }
      : null,
  );

  // Returning from the bank page → refresh plan + clean the URL
  useEffect(() => {
    if (!cardResult) return;
    refresh();
    router.replace("/dashboard/billing");
  }, [cardResult, refresh, router]);

  const afterChange = useCallback(async () => {
    await Promise.all([reload(), refresh()]);
  }, [reload, refresh]);

  if (!data) {
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner />
      </div>
    );
  }
  const sub = data.subscription;
  const hasCard = data.cards.length > 0;
  const opts = data.paymentOptions;
  const manualOnly = !opts.qpay && !opts.card;

  async function payWithCard(plan: PlanCode) {
    setBusy(`card-${plan}`);
    setMsg(null);
    try {
      if (hasCard) {
        await post("/billing/card-charge", { plan });
        setMsg({ tone: "success", text: b.cardResult.paid });
        await afterChange();
      } else {
        const r = await post<{ redirectUrl: string }>("/billing/cards/setup", { payPlan: plan, autoRenew: true });
        window.location.assign(r.redirectUrl);
      }
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : t.common.error });
    } finally {
      setBusy(null);
    }
  }

  async function addCard() {
    setBusy("add-card");
    const r = await post<{ redirectUrl: string }>("/billing/cards/setup", { autoRenew: sub.autoRenew });
    window.location.assign(r.redirectUrl);
  }

  async function toggleAutoRenew(v: boolean) {
    setMsg(null);
    try {
      await patch("/billing/subscription", { autoRenew: v });
      await afterChange();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof ApiError ? e.message : t.common.error });
    }
  }

  return (
    <div>
      <PageHeader title={b.title} />
      {params.get("welcome") && sub.status === "INCOMPLETE" && (
        <Alert tone="success" className="mb-5">
          🎉 {b.welcome}
        </Alert>
      )}
      {msg && (
        <Alert tone={msg.tone} className="mb-5">
          {msg.text}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <p className="text-sm text-muted">{b.current}</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-bold">{l(sub.planDef.name)}</h2>
            <Badge
              className={cx(
                sub.status === "ACTIVE" && "!bg-emerald-100 !text-emerald-700",
                sub.status === "PAST_DUE" && "!bg-amber-100 !text-amber-700",
                (sub.status === "EXPIRED" || sub.status === "INCOMPLETE") && "!bg-red-100 !text-red-700",
              )}
            >
              {b.status[sub.status]}
            </Badge>
            {sub.accessEndsAt && <span className="text-sm text-muted">{b.validUntil(date(sub.accessEndsAt, lang))}</span>}
          </div>
          {sub.status === "PAST_DUE" && data.payments[0]?.failureReason && <p className="mt-2 text-sm text-amber-700">⚠️ {data.payments[0].failureReason}</p>}

          {opts.card && (
          <div className="mt-5 flex items-start justify-between gap-4 rounded-xl bg-slate-50 p-4">
            <div>
              <p className="font-medium">🔄 {b.autoRenew}</p>
              <p className="mt-0.5 text-sm text-muted">
                {!hasCard
                  ? b.needCard
                  : sub.autoRenew && sub.status === "PAST_DUE" && sub.nextRetryAt
                    ? b.retrying(dateTime(sub.nextRetryAt, lang))
                    : sub.autoRenew && sub.accessEndsAt
                      ? b.autoRenewOn(date(sub.accessEndsAt, lang))
                      : b.autoRenewOff}
              </p>
            </div>
            <Toggle checked={sub.autoRenew} disabled={!hasCard} onChange={toggleAutoRenew} />
          </div>
          )}
        </Card>

        {!opts.card ? (
          <Card className="p-5">
            <h3 className="font-semibold">🏦 {b.manualTitle}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{b.manualText}</p>
            {opts.manualNote && <p className="mt-3 whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm font-medium">{opts.manualNote}</p>}
            <p className="mt-3 text-sm">{b.manualRef(me?.business.name ?? "")}</p>
          </Card>
        ) : (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="font-semibold">{b.cards}</h3>
            <Button size="sm" variant="secondary" className="whitespace-nowrap" onClick={addCard} loading={busy === "add-card"}>
              + {b.addCard}
            </Button>
          </div>
          {data.cards.length ? (
            <div className="space-y-2">
              {data.cards.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl border border-line p-3">
                  <div>
                    <p className="text-sm font-semibold">
                      💳 {c.brand} •••• {c.last4}
                    </p>
                    <p className="text-xs text-muted">
                      {String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}
                      {c.isDefault && <span className="ml-2 font-medium text-brand-600">{b.default}</span>}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    {!c.isDefault && (
                      <Button size="sm" variant="ghost" onClick={() => post(`/billing/cards/${c.id}/default`).then(afterChange)}>
                        {b.makeDefault}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => confirm(t.common.confirmDelete) && del(`/billing/cards/${c.id}`).then(afterChange)}>
                      ✕
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted">{b.noCards}</p>
          )}
        </Card>
        )}
      </div>

      <h2 className="mb-1 mt-10 text-lg font-bold">{b.choosePlan}</h2>
      <p className="mb-4 text-sm text-muted">{b.upgradeNote}</p>
      <div className="grid gap-5 lg:grid-cols-3">
        {PLANS.map((p) => {
          const current = p.code === sub.plan && sub.status !== "INCOMPLETE";
          const chosen = p.code === (params.get("plan") ?? sub.plan) && sub.status === "INCOMPLETE";
          return (
            <Card key={p.code} className={cx("flex flex-col p-5", (current || chosen) && "ring-2 ring-brand-500")}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">{l(p.name)}</h3>
                {current && <Badge className="!bg-brand-100 !text-brand-700">{b.currentPlan}</Badge>}
              </div>
              <p className="mt-2 text-3xl font-extrabold tracking-tight">
                {money(p.price, lang)}
                <span className="text-sm font-normal text-muted">{t.common.perMonth}</span>
              </p>
              <div className="mt-4 grid gap-2">
                {opts.qpay && (
                  <Button onClick={() => setQpayPlan(p.code)} className="!bg-[#00a0e3] hover:!bg-[#008bc6]">
                    {b.payQPay}
                  </Button>
                )}
                {opts.card && (
                  <Button variant="outline" onClick={() => payWithCard(p.code)} loading={busy === `card-${p.code}`}>
                    💳 {hasCard ? `${b.payCard} •••• ${data.cards.find((c) => c.isDefault)?.last4 ?? data.cards[0].last4}` : b.payNewCard}
                  </Button>
                )}
                {manualOnly && <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-center text-sm text-muted">🏦 {b.manualTitle}</p>}
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <PlanFeatures plan={p} />
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-4 mt-10 text-lg font-bold">{b.history}</h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <tbody className="divide-y divide-line">
            {data.payments.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-center text-muted">{t.common.none}</td>
              </tr>
            )}
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td className="px-5 py-3 text-muted">{dateTime(p.paidAt ?? p.createdAt, lang)}</td>
                <td className="px-5 py-3 font-medium">{l(PLANS.find((x) => x.code === p.plan)!.name)}</td>
                <td className="px-5 py-3">
                  {p.method === "QPAY" ? "QPay" : p.method === "MANUAL" ? (lang === "en" ? "Bank transfer" : "Дансаар") : `💳 •••• ${p.paymentMethod?.last4 ?? ""}`}
                  {p.isAutoCharge && <Badge className="ml-2">{b.auto}</Badge>}
                </td>
                <td className="px-5 py-3 font-semibold">{money(p.amount, lang)}</td>
                <td className="px-5 py-3">
                  <Badge
                    className={cx(
                      p.status === "PAID" && "!bg-emerald-100 !text-emerald-700",
                      p.status === "FAILED" && "!bg-red-100 !text-red-700",
                      p.status === "PENDING" && "!bg-amber-100 !text-amber-700",
                    )}
                  >
                    {b.pstatus[p.status]}
                  </Badge>
                  {p.failureReason && <span className="ml-2 text-xs text-red-600">{p.failureReason}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {qpayPlan && <QPayModal key={qpayPlan} plan={qpayPlan} onClose={() => setQpayPlan(null)} onPaid={afterChange} />}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingInner />
    </Suspense>
  );
}
