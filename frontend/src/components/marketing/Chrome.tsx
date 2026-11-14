"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export function Eyebrow({ children, light }: { children: ReactNode; light?: boolean }) {
  return <p className={cx("mb-3 text-sm font-semibold uppercase tracking-wider", light ? "text-brand-300" : "text-brand-600")}>{children}</p>;
}

export function SectionTitle({ eyebrow, title, subtitle, more }: { eyebrow?: string; title: string; subtitle?: string; more?: { href: string; label: string } }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-base text-muted sm:text-lg">{subtitle}</p>}
      {more && (
        <Link href={more.href} className="mt-4 inline-flex text-sm font-semibold text-brand-700 hover:underline">
          {more.label} →
        </Link>
      )}
    </div>
  );
}

/** Top band of every inner marketing page */
export function PageHero({ eyebrow, title, subtitle, children }: { eyebrow: string; title: string; subtitle: string; children?: ReactNode }) {
  return (
    <section className="bg-mint relative overflow-hidden border-b border-line">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-14 text-center sm:pt-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}

export function CtaBand() {
  const { t } = useI18n();
  return (
    <section className="px-4 py-20">
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-700 via-brand-600 to-teal-500 px-6 py-14 text-center text-white shadow-2xl shadow-brand-700/25 sm:px-12">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-lime-300/20 blur-2xl" />
        <h2 className="relative text-3xl font-extrabold tracking-tight sm:text-4xl">{t.m.ctaTitle}</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-white/85">{t.m.ctaText}</p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/register" className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-7 font-semibold text-brand-700 shadow-lg transition hover:-translate-y-0.5">
            {t.m.ctaButton} →
          </Link>
          <Link href="/pricing" className="inline-flex h-12 items-center justify-center rounded-xl border border-white/40 px-7 font-semibold text-white hover:bg-white/10">
            {t.m.ctaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Nav() {
  const { t } = useI18n();
  const { me } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links: Array<[string, string]> = [
    ["/solutions", t.nav.problems],
    ["/industries", t.nav.useCases],
    ["/features", t.nav.features],
    ["/pricing", t.nav.pricing],
    ["/faq", t.nav.faq],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-[#faf6ee]/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Logo />
        <nav className="hidden items-center gap-1 text-sm font-medium lg:flex">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={cx("rounded-lg px-3 py-2 transition", pathname === href ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink")}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LangSwitch />
          {me ? (
            <Link href="/dashboard" className="hidden h-9 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 sm:inline-flex">
              {t.nav.dashboard}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden h-9 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex">
                {t.common.login}
              </Link>
              <Link href="/register" className="hidden h-9 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 sm:inline-flex">
                {t.nav.startFree}
              </Link>
            </>
          )}
          <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={open ? "M6 6l12 12M6 18L18 6" : "M4 7h16M4 12h16M4 17h16"} />
            </svg>
          </button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-[#faf6ee] px-4 py-3 lg:hidden">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={cx("block rounded-lg px-3 py-2.5 text-sm font-medium", pathname === href ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50")}
            >
              {label}
            </Link>
          ))}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Link href={me ? "/dashboard" : "/login"} className="flex h-10 items-center justify-center rounded-xl border border-line text-sm font-semibold">
              {me ? t.nav.dashboard : t.common.login}
            </Link>
            <Link href="/register" className="flex h-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-semibold text-white">
              {t.nav.startFree}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { t, lang } = useI18n();
  const cols: Array<[string, Array<[string, string]>]> = [
    [
      t.nav.features,
      [
        ["/solutions", t.nav.problems],
        ["/industries", t.nav.useCases],
        ["/features", t.nav.features],
      ],
    ],
    [
      t.nav.pricing,
      [
        ["/pricing", t.nav.pricing],
        ["/faq", t.nav.faq],
        ["/register", t.nav.startFree],
      ],
    ],
  ];
  return (
    <footer className="border-t border-line bg-canvas py-12">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted">{t.footer.tagline}</p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title} className="text-sm">
            <p className="font-semibold">{title}</p>
            <ul className="mt-3 space-y-2">
              {links.map(([href, label]) => (
                <li key={href}>
                  <Link href={href} className="text-muted hover:text-brand-700">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-6xl flex-col gap-2 border-t border-line px-4 pt-6 text-xs text-slate-400 sm:flex-row sm:justify-between">
        <span>
          © {BRAND.year} {lang === "en" ? BRAND.nameEn : BRAND.name}. {t.footer.rights}
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/privacy" className="hover:text-brand-700">
            {t.footer.privacy}
          </Link>
          <Link href="/terms" className="hover:text-brand-700">
            {t.footer.terms}
          </Link>
          <Link href="/data-deletion" className="hover:text-brand-700">
            {t.footer.dataDeletion}
          </Link>
          <span>
            {BRAND.supportEmail} · {BRAND.supportPhone}
          </span>
        </span>
      </div>
    </footer>
  );
}

/** Two-column list of numbered ways (tagging / scheduling) */
export function WayList({ title, items, accent }: { title: string; items: Array<{ icon: string; title: string; text: string }>; accent: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-6 sm:p-8">
      <h3 className="text-xl font-bold">{title}</h3>
      <div className="mt-6 space-y-4">
        {items.map((w, i) => (
          <div key={w.title} className="flex gap-4">
            <div className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg", accent)}>{w.icon}</div>
            <div>
              <p className="font-semibold">
                <span className="mr-1.5 text-slate-400">{i + 1}.</span>
                {w.title}
              </p>
              <p className="mt-0.5 text-sm text-muted">{w.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Small chat bubble pair used in industry cards */
export function MiniChat({ chat }: { chat: Array<{ from: string; text: string }> }) {
  return (
    <div className="space-y-2 rounded-2xl bg-canvas p-3">
      {chat.map((m, i) => (
        <div key={i} className={cx("flex", m.from === "user" ? "justify-end" : "justify-start")}>
          <div
            className={cx(
              "max-w-[88%] rounded-2xl px-3 py-1.5 text-xs leading-snug",
              m.from === "user" ? "rounded-br-md bg-gradient-to-br from-brand-500 to-teal-500 text-white" : "rounded-bl-md bg-white text-slate-700 ring-1 ring-line",
            )}
          >
            {m.from !== "user" && "🤖 "}
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}
