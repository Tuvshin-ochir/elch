"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import { en } from "./en";
import { mn, type Dict } from "./mn";

export type Lang = "mn" | "en";
const dicts: Record<Lang, Dict> = { mn, en };

// Language lives in localStorage; useSyncExternalStore keeps SSR ("mn") and client in sync.
const listeners = new Set<() => void>();
function readLang(): Lang {
  try {
    return localStorage.getItem("lang") === "en" ? "en" : "mn";
  } catch {
    return "mn";
  }
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

interface Ctx {
  lang: Lang;
  t: Dict;
  setLang: (l: Lang) => void;
  /** pick the right side of a {mn, en} label */
  l: (x: { mn: string; en: string } | undefined | null) => string;
}

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, readLang, () => "mn" as Lang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    try {
      localStorage.setItem("lang", l);
    } catch {
      /* ignore */
    }
    listeners.forEach((fn) => fn());
  }, []);

  const l = useCallback((x: { mn: string; en: string } | undefined | null) => (x ? x[lang] || x.mn : ""), [lang]);

  return <I18nContext.Provider value={{ lang, t: dicts[lang], setLang, l }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
