"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Button, Input, Label, Spinner } from "@/components/ui";
import { ApiError, get, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import type { BusinessTypeDef, PlanCode } from "@/lib/types";

/** After signing up with Facebook / Instagram: business type, name and plan, then payment. */
function Onboarding() {
  const { t, l, lang } = useI18n();
  const { me, loading, refresh } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [types, setTypes] = useState<BusinessTypeDef[]>([]);
  const [form, setForm] = useState({
    businessType: "",
    businessName: "",
    email: "",
    phone: "",
    plan: (["STARTER", "BUSINESS", "PRO"].includes(params.get("plan") ?? "") ? params.get("plan") : "BUSINESS") as PlanCode,
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<BusinessTypeDef[]>("/business-types").then(setTypes).catch(() => setTypes([]));
  }, []);
  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      await post("/auth/onboarding", {
        businessName: form.businessName || me!.business.name,
        businessType: form.businessType,
        plan: form.plan,
        ...(form.phone ? { phone: form.phone } : {}),
        ...(form.email ? { email: form.email } : {}),
      });
      await refresh();
      router.push(`/dashboard/billing?plan=${form.plan}&welcome=1`);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : t.common.error);
      setBusy(false);
    }
  }

  return (
    <AuthShell title={t.auth.onboardingTitle} subtitle={t.auth.onboardingSub} wide>
      <form onSubmit={submit} className="space-y-5">
        {err && <Alert tone="error">{err}</Alert>}
        <div>
          <Label>{t.auth.businessType}</Label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {types.map((bt) => (
              <button
                key={bt.key}
                type="button"
                onClick={() => setForm({ ...form, businessType: bt.key })}
                className={cx(
                  "flex flex-col items-center gap-1 rounded-xl border p-2.5 text-center text-xs font-medium transition",
                  form.businessType === bt.key ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-line hover:border-brand-300",
                )}
              >
                <span className="text-2xl">{bt.icon}</span>
                {l(bt.label)}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <Label>{t.auth.businessName}</Label>
            <Input required placeholder={me.business.name} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} />
          </label>
          <label className="block">
            <Label>{t.common.phone}</Label>
            <Input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          {!me.user.email && (
            <label className="block sm:col-span-2">
              <Label>{t.auth.onboardingEmail}</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </label>
          )}
        </div>
        <div>
          <Label>{t.auth.plan}</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {PLANS.map((p) => (
              <button
                key={p.code}
                type="button"
                onClick={() => setForm({ ...form, plan: p.code })}
                className={cx("rounded-xl border px-3 py-2.5 text-left transition", form.plan === p.code ? "border-brand-500 bg-brand-50 ring-2 ring-brand-200" : "border-line hover:border-brand-300")}
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
        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!form.businessType}>
          {t.auth.toPayment}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense>
      <Onboarding />
    </Suspense>
  );
}
