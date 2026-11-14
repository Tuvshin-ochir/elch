"use client";

import Link from "next/link";
import { useId } from "react";
import { BRAND } from "@/lib/brand";
import { useI18n } from "@/lib/i18n";

/** The "Э" chat-bubble mark. Same paths as scripts/generate-icons.mjs (favicon, app icons, OG image). */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={`${className} shrink-0 drop-shadow-sm`} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0e6a4b" />
          <stop offset=".55" stopColor="#22a06b" />
          <stop offset="1" stopColor="#a3e635" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${id})`} />
      <path d="M19.6 22.2A15.5 15.5 0 1 1 27 46.5L15 49l3.2-8" fill="none" stroke="#fff" strokeWidth="5.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 32h16" stroke="#fff" strokeWidth="5.6" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", suffix }: { href?: string; suffix?: string }) {
  const { lang } = useI18n();
  return (
    <Link href={href} className="flex items-center gap-2 font-bold tracking-tight">
      <LogoMark />
      <span className="text-lg">{lang === "en" ? BRAND.nameEn : BRAND.name}</span>
      {suffix && <span className="rounded-md bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">{suffix}</span>}
    </Link>
  );
}
