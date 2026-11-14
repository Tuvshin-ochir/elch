"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LangSwitch } from "@/components/LangSwitch";
import { Logo } from "@/components/Logo";
import { Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

const NAV = [
  { href: "/dashboard", key: "overview", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/dashboard/analytics", key: "analytics", icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/dashboard/inbox", key: "inbox", icon: "M4 4h16v12H5.2L4 17.2zM8 9h8M8 12h5" },
  { href: "/dashboard/contacts", key: "contacts", icon: "M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M20 19v-1a3 3 0 0 0-2-2.8M4 19v-1a3 3 0 0 1 2-2.8" },
  { href: "/dashboard/leads", key: "leads", icon: "M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01" },
  { href: "/dashboard/knowledge", key: "knowledge", icon: "M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2zM4 19a2 2 0 0 1 2-2h12" },
  { href: "/dashboard/bot", key: "bot", icon: "M12 3v3M7 9h10a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3zM9 13h.01M15 13h.01" },
  { href: "/dashboard/channels", key: "channels", icon: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" },
  { href: "/dashboard/tags", key: "tags", icon: "M3 12V4h8l9 9-8 8zM7.5 7.5h.01" },
  { href: "/dashboard/ads", key: "ads", icon: "M3 11l15-6v14L3 13zM7 13v5a2 2 0 0 0 4 0v-3.5" },
  { href: "/dashboard/broadcasts", key: "broadcasts", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { href: "/dashboard/billing", key: "billing", icon: "M3 7h18v10H3zM3 11h18M7 15h3" },
] as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { me, loading, logout } = useAuth();
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [loading, me, router]);

  if (loading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const sub = me.subscription;
  const banner =
    sub.status === "PAST_DUE"
      ? { tone: "bg-amber-500 text-white", text: t.dash.banner.pastDue }
      : sub.status === "INCOMPLETE"
        ? { tone: "bg-brand-700 text-white", text: t.dash.banner.unpaid }
        : !sub.active
          ? { tone: "bg-red-600 text-white", text: t.dash.banner.expired }
          : null;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo href="/dashboard" />
      </div>
      <div className="mx-3 mb-3 rounded-xl bg-slate-50 px-3 py-2.5">
        <p className="truncate text-sm font-semibold">{me.business.name}</p>
        <p className="truncate text-xs text-muted">{me.user.email ?? me.user.name}</p>
      </div>
      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => {
          const active = n.href === "/dashboard" ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-50 hover:text-ink",
              )}
            >
              <Icon d={n.icon} />
              {t.dash.nav[n.key]}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center justify-between border-t border-line px-4 py-3">
        <LangSwitch />
        <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-red-600">
          {t.common.logout}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-slate-100" aria-label="Menu">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
          <Logo href="/dashboard" />
          <span className="w-9" />
        </header>
        {banner && (
          <div className={cx("flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-medium", banner.tone)}>
            {banner.text}
            {pathname !== "/dashboard/billing" && (
              <Link href="/dashboard/billing" className="rounded-lg bg-white/20 px-2.5 py-0.5 font-semibold hover:bg-white/30">
                {t.dash.banner.pay} →
              </Link>
            )}
          </div>
        )}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
