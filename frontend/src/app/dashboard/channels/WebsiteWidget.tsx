"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Label, PlatformIcon, Spinner, Textarea, Toggle } from "@/components/ui";
import { get, patch } from "@/lib/api";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

interface WidgetSettings {
  enabled: boolean;
  title: string;
  subtitle: string;
  welcome: string;
  color: string;
  position: "right" | "left";
}

interface WidgetInfo {
  widgetKey: string;
  settings: WidgetSettings;
  scriptUrl: string;
  embedCode: string;
}

const PRESETS = ["#12805a", "#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#0f172a"];

export function WebsiteWidget({ businessName }: { businessName: string }) {
  const { t } = useI18n();
  const c = t.dash.channels;
  const [info, setInfo] = useState<WidgetInfo | null>(null);
  const [s, setS] = useState<WidgetSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    get<WidgetInfo>("/business/widget").then((r) => {
      setInfo(r);
      setS(r.settings);
    });
  }, []);

  if (!info || !s) {
    return (
      <Card className="flex justify-center p-10 text-brand-600">
        <Spinner />
      </Card>
    );
  }

  async function save(next: WidgetSettings) {
    setSaving(true);
    await patch("/business/widget", next);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Card className="p-5 sm:p-6" >
      <div id="website" className="flex flex-wrap items-center justify-between gap-3 scroll-mt-24">
        <div className="flex items-center gap-3">
          <PlatformIcon platform="WEB" className="h-10 w-10" />
          <div>
            <h3 className="text-lg font-bold">{c.webCardTitle}</h3>
            <p className="text-sm text-muted">{c.webCardText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{c.webEnabled}</span>
          <Toggle
            checked={s.enabled}
            onChange={(v) => {
              const next = { ...s, enabled: v };
              setS(next);
              save(next);
            }}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <Label>{c.webTitle}</Label>
              <Input value={s.title} placeholder={c.webTitlePh} onChange={(e) => setS({ ...s, title: e.target.value })} />
            </label>
            <label className="block">
              <Label>{c.webSubtitle}</Label>
              <Input value={s.subtitle} onChange={(e) => setS({ ...s, subtitle: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <Label>{c.webWelcome}</Label>
            <Textarea className="!min-h-[64px]" value={s.welcome} onChange={(e) => setS({ ...s, welcome: e.target.value })} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>{c.webColor}</Label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESETS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setS({ ...s, color: col })}
                    className={cx("h-7 w-7 rounded-full ring-offset-2 transition", s.color === col && "ring-2 ring-slate-400")}
                    style={{ backgroundColor: col }}
                    aria-label={col}
                  />
                ))}
                <input type="color" value={s.color} onChange={(e) => setS({ ...s, color: e.target.value })} className="h-8 w-10 cursor-pointer rounded border border-line" />
              </div>
            </div>
            <div>
              <Label>{c.webPosition}</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["left", "right"] as const).map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setS({ ...s, position: pos })}
                    className={cx("rounded-xl border px-3 py-2 text-sm font-medium", s.position === pos ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line")}
                  >
                    {pos === "left" ? c.webLeft : c.webRight}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={() => save(s)} loading={saving}>
              {t.common.save}
            </Button>
            {saved && <span className="text-sm text-brand-700">✓ {t.common.saved}</span>}
          </div>

          <div className="rounded-xl border border-line bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">{c.embed}</p>
              <div className="flex gap-2">
                <a href={`/widget-demo?key=${info.widgetKey}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100">
                  ↗ {c.webPreview}
                </a>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(info.embedCode);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? t.common.copied : t.common.copy}
                </Button>
              </div>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-ink p-3 text-xs text-brand-100">{info.embedCode}</pre>
            <p className="mt-2 text-xs text-muted">{c.embedHint}</p>
          </div>
        </div>

        {/* Live preview */}
        <div className="relative hidden h-[380px] overflow-hidden rounded-2xl border border-line bg-[linear-gradient(135deg,#f8fafc,#eef2f0)] lg:block">
          <div className="absolute inset-x-0 top-0 flex gap-1.5 border-b border-line bg-white px-3 py-2">
            {["#f87171", "#fbbf24", "#34d399"].map((d) => (
              <span key={d} className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d }} />
            ))}
          </div>
          <div className={cx("absolute bottom-16 w-[230px] overflow-hidden rounded-2xl bg-white shadow-xl", s.position === "left" ? "left-3" : "right-3")}>
            <div className="flex items-center gap-2 px-3 py-2.5 text-white" style={{ backgroundColor: s.color }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/25 text-sm">💬</span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold">{s.title || businessName}</p>
                <p className="truncate text-[10px] opacity-85">{s.subtitle}</p>
              </div>
            </div>
            <div className="space-y-1.5 bg-slate-50 p-2.5">
              <div className="w-fit max-w-[85%] rounded-xl rounded-bl-sm border border-line bg-white px-2.5 py-1.5 text-[11px]">{s.welcome}</div>
              <div className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm px-2.5 py-1.5 text-[11px] text-white" style={{ backgroundColor: s.color }}>
                Сайн байна уу 👋
              </div>
            </div>
          </div>
          <div className={cx("absolute bottom-3 flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg", s.position === "left" ? "left-3" : "right-3")} style={{ backgroundColor: s.color }}>
            💬
          </div>
        </div>
      </div>
    </Card>
  );
}
