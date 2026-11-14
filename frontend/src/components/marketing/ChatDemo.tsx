"use client";

import { useEffect, useMemo, useState } from "react";
import { PlatformIcon } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

/** Animated Messenger-style conversation used in the hero. */
export function ChatDemo() {
  const { t, lang } = useI18n();
  const msgs = t.demo.msgs;
  // Timeline: each bot message is preceded by a "typing" step
  const steps = useMemo(() => {
    const out: Array<{ shown: number; typing: boolean }> = [{ shown: 1, typing: false }];
    for (let i = 1; i < msgs.length; i++) {
      if (msgs[i].from === "bot") out.push({ shown: i, typing: true });
      out.push({ shown: i + 1, typing: false });
    }
    return out;
  }, [msgs]);
  const [tick, setTick] = useState(0);
  const step = steps[Math.min(tick, steps.length - 1)];
  const shown = step.shown;
  const typing = step.typing;

  useEffect(() => {
    const last = tick >= steps.length - 1;
    const delay = last ? 5000 : steps[tick + 1]?.typing ? 1100 : 1500;
    const timer = setTimeout(() => setTick(last ? 0 : tick + 1), delay);
    return () => clearTimeout(timer);
  }, [tick, steps]);

  const visible = msgs.slice(0, shown);
  const showTag = shown >= 2;
  const showLead = shown >= msgs.length;

  return (
    <div className="relative mx-auto w-full max-w-sm">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-300/40 via-teal-200/30 to-lime-200/40 blur-2xl" />
      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white shadow-2xl shadow-brand-900/10">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 to-red-500 text-lg">🍕</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{t.demo.page}</p>
            <p className="flex items-center gap-1 text-xs text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t.demo.online}
            </p>
          </div>
          <PlatformIcon platform="FACEBOOK" className="h-6 w-6" />
          <PlatformIcon platform="INSTAGRAM" className="h-6 w-6" />
        </div>
        <div className="flex h-[380px] flex-col justify-end gap-2 bg-gradient-to-b from-white to-slate-50 px-3 py-4">
          {visible.map((m, i) => (
            <div key={`${i}-${m.text}`} className={`flex animate-pop ${m.from === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
                  m.from === "user" ? "rounded-br-md bg-gradient-to-br from-brand-500 to-teal-500 text-white" : "rounded-bl-md bg-slate-100 text-ink"
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex animate-pop justify-start">
              <div className="flex gap-1 rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 120}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showTag && (
        <div className="absolute -left-4 top-24 hidden animate-pop rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lg sm:block lg:-left-16">
          <p className="text-muted">🏷️ {t.demo.tagAdded}</p>
          <p className="mt-0.5 font-semibold text-blue-600">{lang === "en" ? "Asked price" : "Үнэ асуусан"}</p>
        </div>
      )}
      {showLead && (
        <div className="absolute -right-4 bottom-16 hidden animate-pop rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lg sm:block lg:-right-14">
          <p className="text-muted">🧾 {t.demo.leadSaved}</p>
          <p className="mt-0.5 font-semibold text-emerald-600">2 × Pepperoni · 8811-2233</p>
        </div>
      )}
    </div>
  );
}
