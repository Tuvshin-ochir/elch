"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { LangSwitch } from "@/components/LangSwitch";
import { Alert, Button, Input, Label, Spinner } from "@/components/ui";
import { ApiError, get, post } from "@/lib/api";
import { money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface Session {
  id: string;
  merchant: string;
  customer: string;
  amount: number;
  plan: string | null;
  autoRenew: boolean;
  status: string;
}

function Checkout() {
  const { t, lang } = useI18n();
  const m = t.mockBank;
  const id = useSearchParams().get("session") ?? "";
  const [s, setS] = useState<Session | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState({ number: "", exp: "", cvc: "", holder: "" });

  useEffect(() => {
    if (id) get<Session>(`/mock-bank/sessions/${id}`).then(setS).catch((e) => setErr(e.message));
  }, [id]);

  const fmtNumber = (v: string) => v.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim();
  const fmtExp = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const [mm, yy] = card.exp.split("/");
      const r = await post<{ redirectUrl: string }>(`/mock-bank/sessions/${id}/complete`, {
        cardNumber: card.number,
        expMonth: Number(mm),
        expYear: 2000 + Number(yy),
        cvc: card.cvc,
        holder: card.holder,
      });
      window.location.assign(r.redirectUrl);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
      setBusy(false);
    }
  }

  async function cancel() {
    const r = await post<{ redirectUrl: string }>(`/mock-bank/sessions/${id}/cancel`);
    window.location.assign(r.redirectUrl);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-gradient-to-r from-emerald-700 to-teal-600 px-6 py-5 text-white">
          <div>
            <p className="text-lg font-bold">🏦 {m.title}</p>
            <p className="text-xs text-white/80">Secure payment · 3-D Secure</p>
          </div>
          <LangSwitch />
        </div>
        <div className="p-6">
          <Alert tone="warn" className="mb-5 text-xs">
            {m.subtitle}
          </Alert>
          {!s && !err && (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          )}
          {s && s.status !== "PENDING" ? (
            <Alert tone="error">{m.expired}</Alert>
          ) : s ? (
            <form onSubmit={submit} className="space-y-4">
              <div className="rounded-2xl bg-slate-50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">{m.merchant}</span>
                  <span className="font-medium">{s.merchant}</span>
                </div>
                <div className="mt-2 flex justify-between">
                  <span className="text-muted">{m.amount}</span>
                  <span className="text-lg font-bold">{s.amount ? money(s.amount, lang) : m.cardOnly}</span>
                </div>
                {s.autoRenew && <p className="mt-2 text-xs text-emerald-700">🔄 {m.autoRenew}</p>}
              </div>
              {err && <Alert tone="error">{err}</Alert>}
              <label className="block">
                <Label>{m.cardNumber}</Label>
                <Input inputMode="numeric" required placeholder="4242 4242 4242 4242" value={card.number} onChange={(e) => setCard({ ...card, number: fmtNumber(e.target.value) })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <Label>{m.expiry}</Label>
                  <Input inputMode="numeric" required placeholder="12/30" value={card.exp} onChange={(e) => setCard({ ...card, exp: fmtExp(e.target.value) })} />
                </label>
                <label className="block">
                  <Label>{m.cvc}</Label>
                  <Input inputMode="numeric" required placeholder="123" maxLength={4} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, "") })} />
                </label>
              </div>
              <label className="block">
                <Label>{m.holder}</Label>
                <Input required placeholder="BAT BOLD" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value.toUpperCase() })} />
              </label>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="outline" onClick={cancel} disabled={busy}>
                  {m.cancel}
                </Button>
                <Button type="submit" className="flex-1 !bg-emerald-600 hover:!bg-emerald-700" loading={busy}>
                  {m.submit}
                </Button>
              </div>
              <div className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">
                <p className="mb-1 font-semibold text-slate-600">{m.testCards}</p>
                <p>
                  <code>4242 4242 4242 4242</code> — {m.success}
                </p>
                <p>
                  <code>4000 0000 0000 0002</code> — {m.declined}
                </p>
              </div>
            </form>
          ) : (
            err && <Alert tone="error">{err}</Alert>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MockBankPage() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  );
}
