"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Alert, Spinner } from "@/components/ui";
import { setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

/** Landing page after Facebook / Instagram login. The API puts the session in the URL fragment. */
export default function AuthCompletePage() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, "", window.location.pathname); // drop the token from the address bar
    const token = hash.get("token");
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- error comes from the URL fragment, only readable on the client
      setError(hash.get("error") ?? t.common.error);
      return;
    }
    setToken(token);
    refresh().then(() => {
      const plan = hash.get("plan") ?? "BUSINESS";
      router.replace(hash.get("new") === "1" ? `/onboarding?plan=${plan}` : "/dashboard");
    });
  }, [refresh, router, t.common.error]);

  return (
    <AuthShell title={error ? t.common.error : t.auth.completing} subtitle="">
      {error ? (
        <div className="space-y-4">
          <Alert tone="error">{error}</Alert>
          <Link href="/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
            ← {t.common.login}
          </Link>
        </div>
      ) : (
        <div className="flex justify-center py-8 text-brand-600">
          <Spinner className="h-8 w-8" />
        </div>
      )}
    </AuthShell>
  );
}
