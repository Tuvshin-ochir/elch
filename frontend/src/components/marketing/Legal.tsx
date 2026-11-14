"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { DATA_DELETION, PRIVACY, TERMS, type LegalDoc } from "@/lib/legal";

function LegalArticle({ doc, children }: { doc: LegalDoc; children?: React.ReactNode }) {
  return (
    <section className="py-14 sm:py-20">
      <article className="mx-auto max-w-3xl px-4">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{doc.title}</h1>
        <p className="mt-2 text-sm text-muted">{doc.updated}</p>
        <p className="mt-6 text-base leading-relaxed text-slate-700">{doc.intro}</p>
        {children}
        <div className="mt-8 space-y-8">
          {doc.sections.map((s) => (
            <div key={s.h}>
              <h2 className="text-lg font-bold">{s.h}</h2>
              {s.list && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
                  {s.list.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
              {s.p?.map((x) => (
                <p key={x} className="mt-3 text-sm leading-relaxed text-slate-700">
                  {x}
                </p>
              ))}
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

export function PrivacyPage() {
  const { lang } = useI18n();
  return <LegalArticle doc={PRIVACY[lang]} />;
}

export function TermsPage() {
  const { lang } = useI18n();
  return <LegalArticle doc={TERMS[lang]} />;
}

/** Status of a Meta data-deletion request: /data-deletion?code=… (the URL we return to Meta) */
function DeletionStatus() {
  const { lang } = useI18n();
  const d = DATA_DELETION[lang];
  const code = useSearchParams().get("code");
  const [state, setState] = useState<{ status: string; completedAt: string | null; createdAt: string } | "missing" | null>(null);

  useEffect(() => {
    if (!code) return;
    let alive = true;
    fetch(`${API_URL}/api/meta-callbacks/deletion/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : "missing"))
      .then((x) => alive && setState(x))
      .catch(() => alive && setState("missing"));
    return () => {
      alive = false;
    };
  }, [code]);

  if (!code) return null;
  return (
    <div className="mt-6 rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm font-semibold">{d.statusTitle}</p>
      <p className="mt-1 text-xs text-muted">
        {d.codeLabel}: <code className="font-mono">{code}</code>
      </p>
      {state === null ? (
        <p className="mt-3 text-sm text-muted">…</p>
      ) : state === "missing" ? (
        <p className="mt-3 text-sm text-red-600">{d.notFound}</p>
      ) : (
        <p className="mt-3 text-sm">
          <span className={state.status === "COMPLETED" ? "font-semibold text-brand-700" : "font-semibold text-amber-700"}>
            {state.status === "COMPLETED" ? `✓ ${d.statusDone}` : d.statusPending}
          </span>
          <span className="ml-2 text-muted">{dateTime(state.completedAt ?? state.createdAt, lang)}</span>
        </p>
      )}
    </div>
  );
}

export function DataDeletionPage({ statusSlot }: { statusSlot?: React.ReactNode }) {
  const { lang } = useI18n();
  return <LegalArticle doc={DATA_DELETION[lang]}>{statusSlot}</LegalArticle>;
}

export { DeletionStatus };
