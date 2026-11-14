"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { API_URL } from "@/lib/api";
import { BRAND } from "@/lib/brand";

/** A fake "customer website" that loads the real widget script — for previewing the website chat. */
function Demo() {
  const key = useSearchParams().get("key");
  useEffect(() => {
    if (!key || document.getElementById("elch-widget")) return;
    const s = document.createElement("script");
    s.id = "elch-widget";
    s.src = `${API_URL}/widget.js`;
    s.async = true;
    s.setAttribute("data-key", key);
    document.body.appendChild(s);
  }, [key]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-slate-200 px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-lg font-bold">🛍️ Таны вэбсайт</span>
          <nav className="hidden gap-6 text-sm text-slate-500 sm:flex">
            <span>Нүүр</span>
            <span>Бүтээгдэхүүн</span>
            <span>Холбоо барих</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-sm font-semibold text-emerald-700">{BRAND.name} · widget demo</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Энэ бол таны вэбсайтын жишээ хуудас</h1>
        <p className="mt-4 max-w-xl text-slate-600">
          Баруун (эсвэл зүүн) доод буланд гарч ирсэн чатын товчийг дарж ботоо туршина уу. Энд бичсэн мессеж dashboard-ын Inbox дээр «Вэбсайт» сувгаар харагдана.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-100" />
          ))}
        </div>
        {!key && <p className="mt-8 text-red-600">?key= параметр алга</p>}
      </main>
    </div>
  );
}

export default function WidgetDemoPage() {
  return (
    <Suspense>
      <Demo />
    </Suspense>
  );
}
