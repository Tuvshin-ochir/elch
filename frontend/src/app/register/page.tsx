"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SocialButtons } from "@/components/SocialButtons";
import { Alert, Button, Input, Label } from "@/components/ui";
import { ApiError, get, post, setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import type { BusinessTypeDef, PlanCode } from "@/lib/types";

function RegisterForm() {
  const { t, l, lang } = useI18n();
  const { refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const initialPlan = (["STARTER", "BUSINESS", "PRO"].includes(params.get("plan") ?? "") ? params.get("plan") : "BUSINESS") as PlanCode;

  const [types, setTypes] = useState<BusinessTypeDef[]>([]);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ businessType: "", name: "", email: "", password: "", phone: "", businessName: "", plan: initialPlan });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<BusinessTypeDef[]>("/business-types").then(setTypes).catch(() => setTypes([]));
  }, []);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await post<{ token: string }>("/auth/register", { ...form, phone: form.phone || undefined, locale: lang });
      setToken(r.token);
      await refresh();
      router.push(`/dashboard/billing?plan=${form.plan}&welcome=1`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t.auth.registerTitle} subtitle={t.auth.registerSubtitle} wide>
      <SocialButtons mode="register" plan={form.plan} />
      <div className="mb-6 flex items-center gap-2 text-xs font-semibold">
        {[t.auth.step1, t.auth.step2].map((s, i) => (
          <div key={s} className="flex flex-1 items-center gap-2">
            <span className={cx("flex h-6 w-6 items-center justify-center rounded-full", step > i ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
            <span className={step > i ? "text-ink" : "text-slate-400"}>{s}</span>
            {i === 0 && <span className="h-px flex-1 bg-line" />}
          </div>
        ))}
      </div>

      {step === 1 ? (
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {types.map((bt) => (
              <button
                key={bt.key}
                type="button"
                onClick={() => setForm({ ...form, businessType: bt.key })}
                className={cx(
                  "flex flex-col items-center gap-2 rounded-2xl border p-4 text-center text-sm font-medium transition",
                  form.businessType === bt.key ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-line hover:border-brand-300",
                )}
              >
                <span className="text-3xl">{bt.icon}</span>
                {l(bt.label)}
              </button>
            ))}
          </div>
          {!types.length && <Alert tone="warn">Backend (API) холбогдохгүй байна — `cd backend && npm run dev`</Alert>}
          <Button size="lg" className="mt-6 w-full" disabled={!form.businessType} onClick={() => setStep(2)}>
            {t.auth.next} →
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <Label>{t.auth.businessName}</Label>
              <Input required value={form.businessName} onChange={set("businessName")} />
            </label>
            <label className="block">
              <Label>{t.auth.yourName}</Label>
              <Input required autoComplete="name" value={form.name} onChange={set("name")} />
            </label>
            <label className="block">
              <Label>{t.common.email}</Label>
              <Input type="email" required autoComplete="email" value={form.email} onChange={set("email")} />
            </label>
            <label className="block">
              <Label>{t.common.phone}</Label>
              <Input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} />
            </label>
            <label className="block sm:col-span-2">
              <Label hint={`(${t.auth.passwordHint})`}>{t.auth.password}</Label>
              <Input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set("password")} />
            </label>
          </div>
          <div>
            <Label>{t.auth.plan}</Label>
            <div className="grid gap-2 sm:grid-cols-3">
              {PLANS.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => setForm({ ...form, plan: p.code })}
                  className={cx(
                    "rounded-xl border px-3 py-2.5 text-left transition",
                    form.plan === p.code ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-line hover:border-brand-300",
                  )}
                >
                  <p className="text-sm font-semibold">{l(p.name)}</p>
                  <p className="text-xs text-muted">
                    {money(p.price, lang)}
                    {t.common.perMonth}
                  </p>
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
              ←
            </Button>
            <Button type="submit" size="lg" className="flex-1" loading={loading}>
              {t.common.register}
            </Button>
          </div>
          <p className="text-center text-xs text-muted">{t.auth.agree}</p>
        </form>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        {t.auth.haveAccount}{" "}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">
          {t.common.login}
        </Link>
      </p>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
