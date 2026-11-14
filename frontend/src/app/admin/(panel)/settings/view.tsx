"use client";

import { useState } from "react";
import { useAdminMe } from "@/components/admin/AdminShell";
import { Panel } from "@/components/admin/parts";
import { Alert, Button, Input, Label, PageHeader } from "@/components/ui";
import { apost } from "@/lib/adminApi";
import { dateTime } from "@/lib/format";

export default function AdminSettingsView() {
  const me = useAdminMe();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== repeat) return setMsg({ tone: "error", text: "Шинэ нууц үг таарахгүй байна" });
    setBusy(true);
    setMsg(null);
    try {
      await apost("/password", { current, next });
      setCurrent("");
      setNext("");
      setRepeat("");
      setMsg({ tone: "success", text: "Нууц үг солигдлоо" });
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : "Алдаа гарлаа" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Тохиргоо" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Миний бүртгэл">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Нэр</dt>
              <dd className="font-medium">{me?.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Имэйл</dt>
              <dd>{me?.email}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Сүүлд нэвтэрсэн</dt>
              <dd>{dateTime(me?.lastLoginAt)}</dd>
            </div>
          </dl>
          <p className="mt-4 rounded-xl bg-canvas px-3 py-2.5 text-xs text-muted">
            Шинэ админ нэмэх эсвэл мартсан нууц үгээ сэргээх: <code className="font-mono">{`npm --prefix backend run admin:create -- имэйл "Нэр"`}</code>
          </p>
        </Panel>
        <Panel title="Нууц үг солих">
          <form onSubmit={submit} className="space-y-3">
            {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
            <label className="block">
              <Label>Одоогийн нууц үг</Label>
              <Input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} />
            </label>
            <label className="block">
              <Label hint="(10+ тэмдэгт)">Шинэ нууц үг</Label>
              <Input type="password" autoComplete="new-password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} />
            </label>
            <label className="block">
              <Label>Шинэ нууц үг дахин</Label>
              <Input type="password" autoComplete="new-password" required value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            </label>
            <Button type="submit" loading={busy}>
              Солих
            </Button>
          </form>
        </Panel>
      </div>
    </>
  );
}
