"use client";

import Link from "next/link";
import { useState } from "react";
import { PlatformIcon } from "@/components/ui";
import { cx, money } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import { CtaBand, MiniChat, PageHero, SectionTitle, WayList } from "./Chrome";
import { PaymentMethods, PricingCards } from "./Home";

// ───────── /solutions ─────────

export function SolutionsPage() {
  const { t } = useI18n();
  const s = t.m.solutions;
  return (
    <>
      <PageHero eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl space-y-6 px-4">
          {s.items.map((it, i) => (
            <article key={it.title} className="grid gap-6 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8 lg:grid-cols-[1fr_220px]">
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-2xl">{it.icon}</span>
                  <span className="text-sm font-semibold text-slate-400">0{i + 1}</span>
                </div>
                <h2 className="mt-4 text-2xl font-bold tracking-tight">{it.title}</h2>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-red-50/70 p-4 ring-1 ring-red-100">
                    <p className="text-xs font-bold uppercase tracking-wide text-red-600">{s.problemLabel}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{it.problem}</p>
                  </div>
                  <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-100">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-700">{s.solutionLabel}</p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{it.solution}</p>
                  </div>
                </div>
                <ul className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
                  {it.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-0.5 text-brand-600">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-brand-600 to-teal-500 p-6 text-center text-white">
                <p className="text-4xl font-extrabold tracking-tight">{it.stat.value}</p>
                <p className="mt-1 text-sm text-white/85">{it.stat.label}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-canvas py-16 sm:py-20">
        <div className="mx-auto max-w-4xl px-4">
          <SectionTitle title={s.beforeAfter.title} />
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <div className="grid grid-cols-2 border-b border-line text-sm font-bold">
              <div className="bg-red-50/60 px-5 py-3 text-red-700">✕ {s.beforeAfter.before}</div>
              <div className="bg-brand-50 px-5 py-3 text-brand-800">✓ {s.beforeAfter.after}</div>
            </div>
            {s.beforeAfter.rows.map(([a, b]) => (
              <div key={a} className="grid grid-cols-2 border-b border-line text-sm last:border-0">
                <div className="px-5 py-3.5 text-slate-500">{a}</div>
                <div className="px-5 py-3.5 font-medium">{b}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}

// ───────── /industries ─────────

export function IndustriesPage() {
  const { t } = useI18n();
  const s = t.m.industries;
  return (
    <>
      <PageHero eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {s.items.map((it, i) => (
            <a key={it.title} href={`#ind-${i}`} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-medium hover:border-brand-300 hover:text-brand-700">
              {it.icon} {it.title}
            </a>
          ))}
        </div>
      </PageHero>
      <section className="py-16 sm:py-20">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-2">
          {s.items.map((it, i) => (
            <article id={`ind-${i}`} key={it.title} className="scroll-mt-24 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">{it.icon}</span>
                  <h2 className="text-xl font-bold">{it.title}</h2>
                </div>
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {s.planLabel}: {it.plan}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{it.intro}</p>
              <div className="mt-4">
                <MiniChat chat={it.chat} />
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.handlesLabel}</p>
                  <ul className="mt-2 space-y-1.5 text-sm">
                    {it.handles.map((h) => (
                      <li key={h} className="flex gap-2">
                        <span className="text-brand-600">✓</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{s.fieldsLabel}</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
                    {it.fields.map((f) => (
                      <li key={f} className="flex gap-2">
                        <span className="text-slate-400">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}

// ───────── /features ─────────

export function FeaturesPage() {
  const { t } = useI18n();
  const s = t.m.features;
  const a = t.automation;
  const c = t.dash.channels;
  return (
    <>
      <PageHero eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid gap-5 md:grid-cols-3">
            {(
              [
                ["FACEBOOK", c.fbCardTitle, c.fbCardText],
                ["INSTAGRAM", c.igCardTitle, c.igCardText],
                ["WEB", c.webCardTitle, c.webCardText],
              ] as const
            ).map(([p, title, text]) => (
              <div key={p} className="rounded-2xl border border-line bg-white p-6">
                <PlatformIcon platform={p} className="h-11 w-11" />
                <h3 className="mt-4 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm text-muted">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-14 space-y-6">
            {s.groups.map((g, i) => (
              <div key={g.title} className={cx("grid items-center gap-6 rounded-3xl p-6 sm:p-8 lg:grid-cols-2", i % 2 ? "bg-canvas" : "border border-line bg-white")}>
                <div className={cx(i % 2 === 1 && "lg:order-2")}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-teal-50 text-2xl ring-1 ring-brand-100">{g.icon}</span>
                  <h2 className="mt-4 text-2xl font-bold tracking-tight">{g.title}</h2>
                  <p className="mt-2 text-muted">{g.text}</p>
                </div>
                <ul className={cx("space-y-3", i % 2 === 1 && "lg:order-1")}>
                  {g.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-3 rounded-xl bg-white p-3 text-sm ring-1 ring-line">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-bold text-brand-700">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="bg-canvas py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle eyebrow={a.eyebrow} title={a.title} subtitle={a.subtitle} />
          <div className="grid gap-6 lg:grid-cols-2">
            <WayList title={a.tagTitle} items={a.tagWays} accent="bg-brand-50" />
            <WayList title={a.scheduleTitle} items={a.scheduleWays} accent="bg-lime-50" />
          </div>
          <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">ⓘ {a.note}</p>
        </div>
      </section>
      <CtaBand />
    </>
  );
}

// ───────── /pricing ─────────

export function PricingPage() {
  const { t, l, lang } = useI18n();
  const s = t.m.pricing;
  const yes = <span className="font-bold text-brand-600">✓</span>;
  const no = <span className="text-slate-300">—</span>;
  const rows: Array<[string, (p: (typeof PLANS)[number]) => React.ReactNode]> = [
    [s.rows.connections, (p) => p.limits.pages],
    [s.rows.aiReplies, (p) => p.limits.aiReplies.toLocaleString("en-US")],
    [s.rows.files, (p) => p.limits.knowledgeFiles],
    [s.rows.broadcasts, (p) => p.limits.broadcastsPerMonth ?? "∞"],
    [s.rows.website, () => yes],
    [s.rows.pageSync, () => yes],
    [s.rows.leadCapture, (p) => (p.features.leadCapture ? yes : no)],
    [s.rows.inbox, () => yes],
    [s.rows.manualTags, () => yes],
    [s.rows.analytics, () => yes],
    [s.rows.aiTagging, (p) => (p.features.aiTagging ? yes : no)],
    [s.rows.commentAutoReply, (p) => (p.features.commentAutoReply ? yes : no)],
    [s.rows.imageUnderstanding, (p) => (p.features.imageUnderstanding ? yes : no)],
    [s.rows.sequences, (p) => (p.features.sequences ? yes : no)],
  ];
  return (
    <>
      <PageHero eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle} />
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <PricingCards />

          <h2 className="mb-6 mt-16 text-center text-2xl font-bold">{s.compareTitle}</h2>
          <div className="overflow-x-auto rounded-2xl border border-line bg-white">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas text-left">
                  <th className="px-5 py-4 font-semibold">{s.feature}</th>
                  {PLANS.map((p) => (
                    <th key={p.code} className={cx("px-5 py-4 text-center", p.code === "BUSINESS" && "bg-brand-50")}>
                      <p className="font-bold">{l(p.name)}</p>
                      <p className="text-xs font-normal text-muted">
                        {money(p.price, lang)}
                        {t.common.perMonth}
                      </p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(([label, cell]) => (
                  <tr key={label}>
                    <td className="px-5 py-3 text-slate-700">{label}</td>
                    {PLANS.map((p) => (
                      <td key={p.code} className={cx("px-5 py-3 text-center font-medium", p.code === "BUSINESS" && "bg-brand-50/50")}>
                        {cell(p)}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <td />
                  {PLANS.map((p) => (
                    <td key={p.code} className={cx("px-5 py-4 text-center", p.code === "BUSINESS" && "bg-brand-50/50")}>
                      <Link href={`/register?plan=${p.code}`} className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-xs font-semibold text-white hover:bg-brand-700">
                        {t.pricing.choose}
                      </Link>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-12">
            <PaymentMethods />
          </div>

          <h2 className="mb-6 mt-16 text-center text-2xl font-bold">{s.billingTitle}</h2>
          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {s.billingFaq.map((f) => (
              <div key={f.q} className="rounded-2xl border border-line bg-white p-5">
                <p className="font-semibold">{f.q}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <CtaBand />
    </>
  );
}

// ───────── /faq ─────────

export function FaqPage() {
  const { t } = useI18n();
  const s = t.m.faq;
  const [group, setGroup] = useState(-1);
  const groups = s.groups.map((g, i) => ({ ...g, i })).filter((g) => group < 0 || g.i === group);
  return (
    <>
      <PageHero eyebrow={s.eyebrow} title={s.title} subtitle={s.subtitle}>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[{ i: -1, title: t.common.all }, ...s.groups.map((g, i) => ({ i, title: g.title }))].map((g) => (
            <button
              key={g.i}
              onClick={() => setGroup(g.i)}
              className={cx("rounded-full border px-4 py-1.5 text-sm font-medium transition", group === g.i ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-300")}
            >
              {g.title}
            </button>
          ))}
        </div>
      </PageHero>
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-3xl space-y-10 px-4">
          {groups.map((g) => (
            <div key={g.title}>
              <h2 className="mb-3 text-lg font-bold">{g.title}</h2>
              <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {g.items.map((f) => (
                  <details key={f.q} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                      {f.q}
                      <span className="text-xl text-brand-600 transition group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <CtaBand />
    </>
  );
}
