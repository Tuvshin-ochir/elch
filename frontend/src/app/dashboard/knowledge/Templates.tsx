"use client";

import { useRef, useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { API_URL, getToken } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/** Downloadable templates (format + examples) and uploading a filled one back into the forms. */
export function Templates({ businessType, onImported }: { businessType: string; onImported: () => void }) {
  const { t, lang } = useI18n();
  const k = t.dash.knowledge;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const q = `type=${businessType}&lang=${lang}`;
  const base = `${API_URL}/api/templates`;

  async function upload(file: File) {
    setBusy(true);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`${base}/import`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const data = (await res.json()) as { error?: string; added?: { items: number; faqs: number; fields: number } };
      if (!res.ok || !data.added) throw new Error(data.error ?? t.common.error);
      setMsg({ tone: "success", text: `✓ ${k.tplImported(data.added.items, data.added.faqs, data.added.fields)}` });
      onImported();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : t.common.error });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const dl = "inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold hover:border-brand-300 hover:text-brand-700";
  const files: Array<{ icon: string; title: string; desc?: string; links: Array<[string, string]> }> = [
    { icon: "📗", title: k.tplWorkbook, desc: k.tplWorkbookDesc, links: [["Excel", `${base}/workbook?${q}`]] },
    { icon: "🧾", title: k.tplItems, links: [["Excel", `${base}/items?${q}&format=xlsx`], ["CSV", `${base}/items?${q}&format=csv`]] },
    { icon: "❓", title: k.tplFaq, links: [["Excel", `${base}/faq?${q}&format=xlsx`], ["CSV", `${base}/faq?${q}&format=csv`]] },
    { icon: "📝", title: k.tplInfo, desc: k.tplInfoDesc, links: [["TXT", `${base}/business-info?${q}`]] },
  ];

  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">📄 {k.tplTitle}</h2>
          <p className="mt-0.5 text-sm text-muted">{k.tplSub}</p>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.tsv" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        <Button onClick={() => fileRef.current?.click()} loading={busy}>
          ⬆ {k.tplImport}
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {files.map((f) => (
          <div key={f.title} className="flex flex-col rounded-xl border border-line bg-canvas p-3">
            <p className="text-sm font-semibold">
              {f.icon} {f.title}
            </p>
            {f.desc && <p className="mt-1 text-xs text-muted">{f.desc}</p>}
            <div className="mt-auto flex gap-1.5 pt-3">
              {f.links.map(([label, href]) => (
                <a key={label} href={href} download className={dl}>
                  ⬇ {label}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
      {msg && (
        <Alert tone={msg.tone} className="mt-4">
          {msg.text}
        </Alert>
      )}
    </Card>
  );
}
