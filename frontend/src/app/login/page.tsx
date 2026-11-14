"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SocialButtons } from "@/components/SocialButtons";
import { Alert, Button, Input, Label } from "@/components/ui";
import { ApiError, post, setToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const { t } = useI18n();
  const { refresh } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await post<{ token: string }>("/auth/login", { email, password });
      setToken(r.token);
      await refresh();
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.common.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      <SocialButtons mode="login" />
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <label className="block">
          <Label>{t.common.email}</Label>
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <Label>{t.auth.password}</Label>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          {t.common.login}
        </Button>
        <p className="text-center text-sm text-muted">
          {t.auth.noAccount}{" "}
          <Link href="/register" className="font-semibold text-brand-600 hover:underline">
            {t.common.register}
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
