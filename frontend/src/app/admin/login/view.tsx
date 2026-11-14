"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/Logo";
import { Alert, Button, Input, Label } from "@/components/ui";
import { apost, setAdminToken } from "@/lib/adminApi";
import { BRAND } from "@/lib/brand";

export default function AdminLoginView() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { token } = await apost<{ token: string }>("/login", { email, password });
      setAdminToken(token);
      router.replace("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <LogoMark className="h-10 w-10" />
          <div>
            <p className="text-lg font-bold leading-tight">{BRAND.name} Admin</p>
            <p className="text-xs text-muted">Платформын удирдлага</p>
          </div>
        </div>
        {error && (
          <Alert tone="error" className="mb-4">
            {error}
          </Alert>
        )}
        <label className="block">
          <Label>Имэйл</Label>
          <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="mt-4 block">
          <Label>Нууц үг</Label>
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Button type="submit" size="lg" loading={busy} className="mt-6 w-full">
          Нэвтрэх
        </Button>
      </form>
    </div>
  );
}
