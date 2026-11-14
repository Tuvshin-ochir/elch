"use client";

import Link from "next/link";
import { PlanCard } from "@/components/PlanCard";
import { PlatformIcon } from "@/components/ui";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { PLANS } from "@/lib/plans";
import { ChatDemo } from "./ChatDemo";
import { CtaBand, Eyebrow, SectionTitle, WayList } from "./Chrome";

function Hero() {
  const { t } = useI18n();
  return (
    <section className="bg-mint relative overflow-hidden">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:pt-20 lg:grid-cols-2 lg:gap-10">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3 py-1 text-xs font-semibold text-brand-800">
            <PlatformIcon platform="FACEBOOK" className="h-4 w-4" />
            <PlatformIcon platform="INSTAGRAM" className="h-4 w-4" />
            <PlatformIcon platform="WEB" className="h-4 w-4" />
            {t.hero.badge}
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.4rem]">
            {t.hero.title1} <span className="text-gradient">{t.hero.titleHighlight}</span> {t.hero.title2}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">{t.hero.subtitle}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-brand-600 px-6 text-base font-semibold text-white shadow-lg shadow-brand-600/30 transition hover:-translate-y-0.5 hover:bg-brand-700"
            >
              {t.hero.ctaPrimary} →
            </Link>
            <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-white px-6 text-base font-semibold hover:bg-slate-50">
              {t.hero.ctaSecondary}
            </Link>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600">
            {[t.hero.trust1, t.hero.trust2, t.hero.trust3].map((x) => (
              <span key={x} className="flex items-center gap-1.5">
                <span className="text-brand-500">✓</span>
                {x}
              </span>
            ))}
          </div>
        </div>
        <ChatDemo />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pb-16">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
          {t.stats.map((s) => (
            <div key={s.label} className="bg-white px-4 py-5 text-center">
              <p className="text-2xl font-extrabold tracking-tight text-brand-700">{s.value}</p>
              <p className="mt-1 text-xs text-muted sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Problems() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow={t.problems.eyebrow} title={t.problems.title} subtitle={t.problems.subtitle} more={{ href: "/solutions", label: t.m.learnMore }} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t.problems.items.map((p) => (
            <Link key={p.title} href="/solutions" className="group rounded-2xl border border-line bg-white p-6 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-2xl">{p.icon}</div>
              <h3 className="font-semibold group-hover:text-brand-700">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Channels() {
  const { t } = useI18n();
  const c = t.dash.channels;
  const items = [
    { p: "FACEBOOK" as const, title: c.fbCardTitle, text: c.fbCardText },
    { p: "INSTAGRAM" as const, title: c.igCardTitle, text: c.igCardText },
    { p: "WEB" as const, title: c.webCardTitle, text: c.webCardText },
  ];
  return (
    <section className="bg-canvas py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow={t.m.features.groups[1].title} title={c.chooseTitle} subtitle={c.chooseSub} />
        <div className="grid gap-5 md:grid-cols-3">
          {items.map((x) => (
            <div key={x.p} className="rounded-2xl border border-line bg-white p-6">
              <PlatformIcon platform={x.p} className="h-11 w-11" />
              <h3 className="mt-4 text-lg font-bold">{x.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{x.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow={t.useCases.eyebrow} title={t.useCases.title} subtitle={t.useCases.subtitle} more={{ href: "/industries", label: t.m.learnMore }} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {t.useCases.items.map((u) => (
            <Link key={u.title} href="/industries" className="group rounded-2xl border border-line bg-white p-5 transition hover:border-brand-300 hover:shadow-md">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{u.icon}</span>
                <h3 className="font-semibold leading-tight group-hover:text-brand-700">{u.title}</h3>
              </div>
              <div className="mt-4 space-y-2">
                <div className="ml-auto w-fit max-w-[90%] rounded-2xl rounded-br-md bg-gradient-to-br from-brand-500 to-teal-500 px-3 py-1.5 text-xs text-white">{u.q}</div>
                <div className="w-fit max-w-[90%] rounded-2xl rounded-bl-md bg-canvas px-3 py-1.5 text-xs text-slate-700">🤖 {u.a}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useI18n();
  return (
    <section className="bg-gradient-to-b from-brand-950 to-[#0a1f19] py-20 text-white sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <Eyebrow light>{t.how.eyebrow}</Eyebrow>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{t.how.title}</h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {t.how.steps.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-lime-400 text-lg font-bold text-brand-950">{i + 1}</span>
              <h3 className="mt-4 font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow={t.features.eyebrow} title={t.features.title} subtitle={t.features.subtitle} more={{ href: "/features", label: t.m.learnMore }} />
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((f) => (
            <div key={f.title} className="flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-teal-50 text-xl ring-1 ring-brand-100">{f.icon}</div>
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Automation() {
  const { t } = useI18n();
  const a = t.automation;
  return (
    <section className="bg-canvas py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow={a.eyebrow} title={a.title} subtitle={a.subtitle} />
        <div className="grid gap-6 lg:grid-cols-2">
          <WayList title={a.tagTitle} items={a.tagWays} accent="bg-brand-50" />
          <WayList title={a.scheduleTitle} items={a.scheduleWays} accent="bg-lime-50" />
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted">ⓘ {a.note}</p>
      </div>
    </section>
  );
}

export function PricingCards() {
  const { t } = useI18n();
  return (
    <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
      {PLANS.map((p) => {
        const hl = p.code === "BUSINESS";
        return (
          <PlanCard
            key={p.code}
            plan={p}
            highlight={hl}
            badge={hl ? <span className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow">{t.pricing.popular}</span> : undefined}
            action={
              <Link
                href={`/register?plan=${p.code}`}
                className={cx(
                  "flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition",
                  hl ? "bg-brand-600 text-white hover:bg-brand-700" : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                )}
              >
                {t.pricing.choose}
              </Link>
            }
          />
        );
      })}
    </div>
  );
}

export function PaymentMethods() {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-line bg-gradient-to-br from-canvas to-white p-6 sm:p-8">
      <h3 className="text-center text-lg font-bold">{t.payments.title}</h3>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {[
          { icon: <span className="rounded-md bg-[#00a0e3] px-2 py-1 text-xs font-black text-white">QPay</span>, title: t.payments.qpay, text: t.payments.qpayText },
          { icon: <span className="text-2xl">💳</span>, title: t.payments.card, text: t.payments.cardText },
          { icon: <span className="text-2xl">🔄</span>, title: t.payments.auto, text: t.payments.autoText },
        ].map((x) => (
          <div key={x.title} className="flex items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
            <div className="flex h-10 min-w-10 items-center justify-center">{x.icon}</div>
            <div>
              <p className="font-semibold">{x.title}</p>
              <p className="mt-0.5 text-sm text-muted">{x.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Pricing() {
  const { t } = useI18n();
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-6xl px-4">
        <SectionTitle eyebrow={t.pricing.eyebrow} title={t.pricing.title} subtitle={t.pricing.subtitle} more={{ href: "/pricing", label: t.m.pricing.compareTitle }} />
        <PricingCards />
        <div className="mt-12">
          <PaymentMethods />
        </div>
      </div>
    </section>
  );
}

function FaqTeaser() {
  const { t } = useI18n();
  return (
    <section className="bg-canvas py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4">
        <SectionTitle eyebrow={t.faq.eyebrow} title={t.faq.title} more={{ href: "/faq", label: t.m.learnMore }} />
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
          {t.faq.items.slice(0, 4).map((f) => (
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
    </section>
  );
}

export function Home() {
  return (
    <>
      <Hero />
      <Problems />
      <Channels />
      <UseCases />
      <HowItWorks />
      <Features />
      <Automation />
      <Pricing />
      <FaqTeaser />
      <CtaBand />
    </>
  );
}
