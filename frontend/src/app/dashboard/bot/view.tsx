"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, Input, Label, PageHeader, Spinner, Textarea, Toggle } from "@/components/ui";
import { ApiError, get, patch, post } from "@/lib/api";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { useAuth } from "@/lib/auth";
import Link from "next/link";
import type { BotSettings, Business, Lead, Message, Tag } from "@/lib/types";

interface PlaygroundState {
  messages: Message[];
  tags: Tag[];
  leads: Lead[];
  contact: { needsHuman: boolean };
}

function Playground() {
  const { t } = useI18n();
  const b = t.dash.bot;
  const [state, setState] = useState<PlaygroundState | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const load = () => get<PlaygroundState>("/playground").then(setState);
  useEffect(() => {
    get<PlaygroundState>("/playground").then(setState);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state?.messages.length, busy]);

  async function send(msg?: string) {
    const body = (msg ?? text).trim();
    if (!body || busy) return;
    setText("");
    setErr("");
    setBusy(true);
    setState((s) =>
      s ? { ...s, messages: [...s.messages, { id: `tmp-${Date.now()}`, direction: "IN", sender: "CUSTOMER", text: body, createdAt: new Date().toISOString() } as Message] } : s,
    );
    try {
      await post("/playground/message", { text: body });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      await load();
      setBusy(false);
    }
  }

  async function reset() {
    await post("/playground/reset");
    load();
  }

  return (
    <Card className="flex h-[calc(100vh-10rem)] min-h-[520px] flex-col overflow-hidden lg:sticky lg:top-6">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <p className="font-semibold">🧪 {b.playground}</p>
          <p className="text-xs text-muted">{b.playgroundHint}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={reset}>
          ↺ {b.reset}
        </Button>
      </div>

      {state && (state.tags.length > 0 || state.leads.length > 0 || state.contact.needsHuman) && (
        <div className="space-y-1.5 border-b border-line bg-slate-50 px-4 py-2.5 text-xs">
          {state.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-muted">{b.appliedTags}:</span>
              {state.tags.map((tg) => (
                <Badge key={tg.id} color={tg.color}>
                  {tg.name} <span className="opacity-60">· {tg.source}</span>
                </Badge>
              ))}
            </div>
          )}
          {state.leads.map((l) => (
            <p key={l.id} className="text-emerald-700">
              🧾 {b.leads}: {l.details} {l.phone && `· ${l.phone}`}
            </p>
          ))}
          {state.contact.needsHuman && <p className="text-amber-700">🙋 {b.handoffFlag}</p>}
        </div>
      )}

      <div className="scrollbar-thin flex-1 space-y-2 overflow-y-auto bg-gradient-to-b from-white to-slate-50 px-4 py-4">
        {!state ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner />
          </div>
        ) : (
          state.messages.map((m) => (
            <div key={m.id} className={cx("flex", m.direction === "IN" ? "justify-end" : "justify-start")}>
              <div
                className={cx(
                  "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                  m.direction === "IN" ? "rounded-br-md bg-gradient-to-br from-brand-500 to-teal-500 text-white" : "rounded-bl-md bg-slate-100",
                )}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
        {busy && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 120}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {err && (
        <Alert tone="error" className="mx-3 mb-2 text-xs">
          {err}
        </Alert>
      )}
      {state?.messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {b.suggestions.map((s) => (
            <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-1 text-xs hover:border-brand-300 hover:bg-brand-50">
              {s}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input value={text} placeholder={b.typeHere} onChange={(e) => setText(e.target.value)} disabled={busy} />
        <Button type="submit" disabled={!text.trim() || busy}>
          {t.common.send}
        </Button>
      </form>
    </Card>
  );
}

export default function BotPage() {
  const { t } = useI18n();
  const b = t.dash.bot;
  const { me } = useAuth();
  const { data: biz } = useApi<Business>("/business");
  return (
    <div>
      <PageHeader title={b.title} subtitle={b.subtitle} />
      {me && !me.subscription.active && (
        <Alert tone="warn" className="mb-5">
          {b.playgroundInactive}{" "}
          <Link href="/dashboard/billing" className="font-semibold underline">
            {t.dash.banner.pay} →
          </Link>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        {!biz ? (
          <div className="flex justify-center py-16 text-brand-600">
            <Spinner />
          </div>
        ) : (
          <SettingsForm initial={biz.botSettings} />
        )}
        <Playground />
      </div>
    </div>
  );
}

function SettingsForm({ initial }: { initial: BotSettings }) {
  const { t } = useI18n();
  const b = t.dash.bot;
  const [s, setS] = useState<BotSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  async function save() {
    setSaving(true);
    await patch("/business", { botSettings: s });
    setSaving(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
  }

  return (
          <Card className="space-y-5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 p-4">
              <div>
                <p className="font-semibold">{b.enabled}</p>
                <p className="text-xs text-muted">{b.enabledHint}</p>
              </div>
              <Toggle checked={s.enabled} onChange={(v) => setS({ ...s, enabled: v })} />
            </div>
            <label className="block">
              <Label>{b.botName}</Label>
              <Input value={s.botName} placeholder={b.botNamePh} onChange={(e) => setS({ ...s, botName: e.target.value })} />
            </label>
            <div>
              <Label>{b.tone}</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["friendly", "formal", "playful"] as const).map((tone) => (
                  <button
                    key={tone}
                    onClick={() => setS({ ...s, tone })}
                    className={cx(
                      "rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                      s.tone === tone ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line hover:border-brand-300",
                    )}
                  >
                    {b.tones[tone]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">😊 {b.emoji}</span>
              <Toggle checked={s.useEmoji} onChange={(v) => setS({ ...s, useEmoji: v })} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">🧾 {b.collectLeads}</span>
              <Toggle checked={s.collectLeads} onChange={(v) => setS({ ...s, collectLeads: v })} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-medium">📍 {b.askProfile}</span>
              <Toggle checked={s.askProfile} onChange={(v) => setS({ ...s, askProfile: v })} />
            </div>
            <label className="block">
              <Label>{b.greeting}</Label>
              <Input value={s.greeting} placeholder={b.greetingPh} onChange={(e) => setS({ ...s, greeting: e.target.value })} />
            </label>
            <label className="block">
              <Label>{b.handoff}</Label>
              <Input value={s.handoffMessage} onChange={(e) => setS({ ...s, handoffMessage: e.target.value })} />
            </label>
            <label className="block">
              <Label>{b.instructions}</Label>
              <Textarea className="min-h-[120px]" value={s.customInstructions} placeholder={b.instructionsPh} onChange={(e) => setS({ ...s, customInstructions: e.target.value })} />
            </label>
            <div className="flex items-center gap-3">
              <Button onClick={save} loading={saving}>
                {t.common.save}
              </Button>
              {ok && <span className="text-sm text-emerald-600">✓ {t.common.saved}</span>}
            </div>
          </Card>
  );
}
