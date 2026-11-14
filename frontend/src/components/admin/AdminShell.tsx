"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { Spinner } from "@/components/ui";
import { aget, getAdminToken, setAdminToken } from "@/lib/adminApi";
import { cx } from "@/lib/format";

export interface AdminMe {
  id: string;
  email: string;
  name: string;
  lastLoginAt: string | null;
}

const AdminCtx = createContext<AdminMe | null>(null);
export const useAdminMe = () => useContext(AdminCtx);

const NAV = [
  { href: "/admin", label: "Тойм", icon: "M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10" },
  { href: "/admin/businesses", label: "Харилцагчид", icon: "M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4" },
  { href: "/admin/payments", label: "Төлбөрүүд", icon: "M3 7h18v10H3zM3 11h18M7 15h3" },
  { href: "/admin/settings", label: "Тохиргоо", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" },
] as const;

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<AdminMe | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    aget<AdminMe>("/me")
      .then(setMe)
      .catch(() => router.replace("/admin/login"));
  }, [router]);

  if (!me) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-brand-600">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  const logout = () => {
    setAdminToken(null);
    window.location.replace("/admin/login");
  };

  const sidebar = (
    <div className="flex h-full flex-col text-slate-300">
      <div className="px-5 py-5 text-white">
        <Logo href="/admin" suffix="Admin" />
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map((n) => {
          const active = n.href === "/admin" ? pathname === n.href : pathname.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={cx(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                active ? "bg-white/10 text-white" : "hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon d={n.icon} />
              {n.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-3">
        <p className="truncate text-sm font-semibold text-white">{me.name}</p>
        <p className="truncate text-xs text-slate-400">{me.email}</p>
        <div className="mt-2 flex items-center justify-between text-sm">
          <Link href="/" className="text-slate-400 hover:text-white">
            Сайт руу ↗
          </Link>
          <button onClick={logout} className="font-medium text-slate-400 hover:text-red-400">
            Гарах
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AdminCtx.Provider value={me}>
      <div className="min-h-screen bg-canvas">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-ink lg:block">{sidebar}</aside>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-slate-900/50" />
            <aside className="absolute inset-y-0 left-0 w-72 bg-ink shadow-xl" onClick={(e) => e.stopPropagation()}>
              {sidebar}
            </aside>
          </div>
        )}
        <div className="lg:pl-60">
          <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-ink px-4 text-white lg:hidden">
            <button onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white/10" aria-label="Цэс">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <Logo href="/admin" suffix="Admin" />
            <span className="w-9" />
          </header>
          <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
        </div>
      </div>
    </AdminCtx.Provider>
  );
}
