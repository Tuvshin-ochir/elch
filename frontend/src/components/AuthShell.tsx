"use client";

import type { ReactNode } from "react";
import { LangSwitch } from "./LangSwitch";
import { Logo } from "./Logo";

export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black,transparent_65%)]" />
      <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <LangSwitch />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center">
        <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-3xl border border-line bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8`}>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
