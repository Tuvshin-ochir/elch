"use client";

import { useEffect, useState } from "react";
import { Alert, PlatformIcon, Spinner } from "@/components/ui";
import { ApiError, get } from "@/lib/api";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

/** "Continue with Facebook / Instagram" — signs up or logs in, and connects the channel in the same step. */
export function SocialButtons({ mode, plan }: { mode: "login" | "register"; plan?: string }) {
  const { t } = useI18n();
  const [social, setSocial] = useState<{ facebook: boolean; instagram: boolean } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    get<{ social: { facebook: boolean; instagram: boolean } }>("/plans")
      .then((r) => setSocial(r.social))
      .catch(() => setSocial({ facebook: false, instagram: false }));
  }, []);

  async function start(provider: "facebook" | "instagram") {
    setErr("");
    setBusy(provider);
    try {
      const r = await get<{ url: string }>(`/auth/oauth/${provider}/start${plan ? `?plan=${plan}` : ""}`);
      window.location.assign(r.url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
      setBusy(null);
    }
  }

  const btn = "flex h-12 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";
  return (
    <div>
      <div className="grid gap-2.5">
        <button type="button" disabled={!social?.facebook || !!busy} onClick={() => start("facebook")} className={cx(btn, "border-[#0866ff] bg-[#0866ff] text-white hover:bg-[#0757d6]")}>
          {busy === "facebook" ? <Spinner className="h-5 w-5" /> : <PlatformIcon platform="FACEBOOK" className="h-6 w-6 rounded-full bg-white" />}
          {mode === "register" ? t.auth.registerFb : t.auth.continueFb}
        </button>
        <button
          type="button"
          disabled={!social?.instagram || !!busy}
          onClick={() => start("instagram")}
          className={cx(btn, "border-transparent bg-gradient-to-r from-amber-500 via-pink-500 to-violet-600 text-white hover:opacity-90")}
        >
          {busy === "instagram" ? <Spinner className="h-5 w-5" /> : <PlatformIcon platform="INSTAGRAM" className="h-6 w-6 rounded-md bg-white p-0.5" />}
          {mode === "register" ? t.auth.registerIg : t.auth.continueIg}
        </button>
      </div>
      {social && (!social.facebook || !social.instagram) && <p className="mt-2 text-center text-[11px] text-muted">ⓘ {t.auth.socialOff}</p>}
      {mode === "register" && <p className="mt-3 text-center text-xs text-muted">{t.auth.socialHint}</p>}
      {err && (
        <Alert tone="error" className="mt-3">
          {err}
        </Alert>
      )}
      <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-line" />
        {t.auth.orEmail}
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
