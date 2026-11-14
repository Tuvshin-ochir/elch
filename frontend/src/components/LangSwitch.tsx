"use client";

import { useI18n } from "@/lib/i18n";
import { cx } from "@/lib/format";

export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cx("inline-flex rounded-lg border border-line bg-white p-0.5 text-xs font-semibold", className)}>
      {(["mn", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={cx("rounded-md px-2 py-1 uppercase transition", lang === l ? "bg-brand-600 text-white" : "text-slate-500 hover:text-ink")}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
