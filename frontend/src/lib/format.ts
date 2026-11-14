export function money(n: number, lang: string = "mn") {
  return `${new Intl.NumberFormat(lang === "en" ? "en-US" : "mn-MN").format(n)}₮`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** mn: 2026.11.07 · en: Nov 7, 2026 */
export function date(d: string | Date | null | undefined, lang = "mn") {
  if (!d) return "—";
  const x = new Date(d);
  if (lang !== "en") return `${x.getFullYear()}.${pad(x.getMonth() + 1)}.${pad(x.getDate())}`;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(x);
}

/** mn: 11.07 18:50 · en: Nov 7, 6:50 PM */
export function dateTime(d: string | Date | null | undefined, lang = "mn") {
  if (!d) return "—";
  const x = new Date(d);
  if (lang !== "en") return `${pad(x.getMonth() + 1)}.${pad(x.getDate())} ${pad(x.getHours())}:${pad(x.getMinutes())}`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(x);
}

export function timeAgo(d: string | Date | null | undefined, lang = "mn") {
  if (!d) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (lang !== "en") {
    // Intl has patchy Mongolian support → format by hand
    if (s < 60) return "дөнгөж сая";
    if (s < 3600) return `${Math.round(s / 60)} мин өмнө`;
    if (s < 86400) return `${Math.round(s / 3600)} цагийн өмнө`;
    if (s < 7 * 86400) return `${Math.round(s / 86400)} өдрийн өмнө`;
    return date(d, lang);
  }
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });
  if (s < 60) return "just now";
  if (s < 3600) return rtf.format(-Math.round(s / 60), "minute");
  if (s < 86400) return rtf.format(-Math.round(s / 3600), "hour");
  if (s < 7 * 86400) return rtf.format(-Math.round(s / 86400), "day");
  return date(d, lang);
}

export function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}
