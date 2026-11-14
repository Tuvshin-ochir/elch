"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { API_URL, ApiError, del, get, getToken, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx, dateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { Business, BusinessTypeDef, KnowledgeSource } from "@/lib/types";
import { Templates } from "./Templates";

type Tab = "profile" | "items" | "faq" | "files";

/** Minimal CSV parser (quotes, commas, newlines). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === "," || c === ";" || c === "\t") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

function ProfileEditor({ biz, types, onSaved }: { biz: Business; types: BusinessTypeDef[]; onSaved: () => void }) {
  const { t, l } = useI18n();
  const k = t.dash.knowledge;
  const [type, setType] = useState(biz.businessType);
  const [fields, setFields] = useState(biz.profile.fields);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const def = types.find((x) => x.key === type) ?? biz.typeDef;

  async function save() {
    setSaving(true);
    await patch("/business", { businessType: type, profile: { ...biz.profile, fields } });
    setSaving(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
    onSaved();
  }

  return (
    <Card className="p-5 sm:p-6">
      <label className="mb-6 block max-w-sm">
        <Label>{k.type}</Label>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((bt) => (
            <option key={bt.key} value={bt.key}>
              {bt.icon} {l(bt.label)}
            </option>
          ))}
        </Select>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {def.fields.map((f) => (
          <label key={f.key} className={cx("block", f.type === "textarea" && "sm:col-span-2")}>
            <Label>{l(f.label)}</Label>
            {f.type === "textarea" ? (
              <Textarea value={fields[f.key] ?? ""} placeholder={l(f.placeholder)} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
            ) : (
              <Input value={fields[f.key] ?? ""} placeholder={l(f.placeholder)} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <Button onClick={save} loading={saving}>
          {t.common.save}
        </Button>
        {ok && <span className="text-sm text-emerald-600">✓ {t.common.saved}</span>}
      </div>
    </Card>
  );
}

function ItemsEditor({ biz, onSaved }: { biz: Business; onSaved: () => void }) {
  const { t, l } = useI18n();
  const k = t.dash.knowledge;
  const cols = biz.typeDef.items.columns;
  const [items, setItems] = useState<Array<Record<string, string>>>(biz.profile.items.length ? biz.profile.items : [{}]);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save() {
    setSaving(true);
    const clean = items.filter((it) => Object.values(it).some((v) => v?.trim()));
    await patch("/business", { profile: { ...biz.profile, items: clean } });
    setSaving(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
    onSaved();
  }

  async function importCsv(file: File) {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) return;
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const map = header.map((h) => cols.find((c) => [c.key, c.label.mn, c.label.en].some((x) => x.toLowerCase() === h))?.key ?? null);
    const fallback = cols[cols.length - 1].key;
    const imported = rows.slice(1).map((r) => {
      const it: Record<string, string> = {};
      r.forEach((v, i) => {
        const key = map[i] ?? (i === 0 ? cols[0].key : fallback);
        it[key] = it[key] ? `${it[key]}; ${header[i]}: ${v}` : v;
      });
      return it;
    });
    setItems([...items.filter((it) => Object.values(it).some((v) => v?.trim())), ...imported]);
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-semibold">{l(biz.typeDef.items.label)}</h3>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} title={k.csvHint}>
            ⬆ {k.importCsv}
          </Button>
        </div>
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              {cols.map((c) => (
                <th key={c.key} className="px-1 pb-2 font-medium">
                  {l(c.label)}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key} className="p-1">
                    <Input value={it[c.key] ?? ""} onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, [c.key]: e.target.value } : x)))} />
                  </td>
                ))}
                <td className="p-1">
                  <button className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setItems(items.filter((_, j) => j !== i))}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">{k.csvHint}</p>
      <div className="mt-5 flex items-center gap-3">
        <Button variant="secondary" onClick={() => setItems([...items, {}])}>
          + {k.addItem}
        </Button>
        <Button onClick={save} loading={saving}>
          {t.common.save}
        </Button>
        {ok && <span className="text-sm text-emerald-600">✓ {t.common.saved}</span>}
      </div>
    </Card>
  );
}

function FaqEditor({ biz, onSaved }: { biz: Business; onSaved: () => void }) {
  const { t } = useI18n();
  const k = t.dash.knowledge;
  const [faqs, setFaqs] = useState(biz.profile.faqs.length ? biz.profile.faqs : [{ q: "", a: "" }]);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  async function save() {
    setSaving(true);
    await patch("/business", { profile: { ...biz.profile, faqs: faqs.filter((f) => f.q.trim() && f.a.trim()) } });
    setSaving(false);
    setOk(true);
    setTimeout(() => setOk(false), 2000);
    onSaved();
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="space-y-4">
        {faqs.map((f, i) => (
          <div key={i} className="relative rounded-xl border border-line p-4">
            <button className="absolute right-2 top-2 rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setFaqs(faqs.filter((_, j) => j !== i))}>
              ✕
            </button>
            <label className="block">
              <Label>{k.question}</Label>
              <Input value={f.q} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            </label>
            <label className="mt-3 block">
              <Label>{k.answer}</Label>
              <Textarea value={f.a} onChange={(e) => setFaqs(faqs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            </label>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <Button variant="secondary" onClick={() => setFaqs([...faqs, { q: "", a: "" }])}>
          + {k.addFaq}
        </Button>
        <Button onClick={save} loading={saving}>
          {t.common.save}
        </Button>
        {ok && <span className="text-sm text-emerald-600">✓ {t.common.saved}</span>}
      </div>
    </Card>
  );
}

function Sources() {
  const { t, lang } = useI18n();
  const k = t.dash.knowledge;
  const { refresh } = useAuth();
  const { data: sources, reload } = useApi<KnowledgeSource[]>("/knowledge");
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState("");
  const [url, setUrl] = useState("");
  const [text, setText] = useState({ title: "", content: "" });
  const [viewing, setViewing] = useState<(KnowledgeSource & { content: string }) | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // poll while something is processing
  const processing = sources?.some((s) => s.status === "PROCESSING");
  useEffect(() => {
    if (!processing) return;
    const id = setInterval(reload, 2500);
    return () => clearInterval(id);
  }, [processing, reload]);

  async function upload(files: FileList | File[]) {
    const list = Array.from(files);
    if (!list.length) return;
    setErr("");
    setUploading(true);
    const fd = new FormData();
    list.forEach((f) => fd.append("files", f));
    try {
      const res = await fetch(`${API_URL}/api/knowledge/files`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed");
      await Promise.all([reload(), refresh()]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.common.error);
    } finally {
      setUploading(false);
    }
  }

  async function importUrl() {
    if (!url.trim()) return;
    setErr("");
    try {
      await post("/knowledge/url", { url: url.trim() });
      setUrl("");
      reload();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    }
  }

  async function addText() {
    if (!text.title.trim() || !text.content.trim()) return;
    await post("/knowledge/text", text);
    setText({ title: "", content: "" });
    reload();
  }

  async function open(id: string) {
    setViewing(await get(`/knowledge/${id}`));
  }

  async function saveViewing() {
    if (!viewing) return;
    await patch(`/knowledge/${viewing.id}`, { title: viewing.title, content: viewing.content });
    setViewing(null);
    reload();
  }

  return (
    <div className="space-y-6">
      {err && <Alert tone="error">{err}</Alert>}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          upload(e.dataTransfer.files);
        }}
        onClick={() => fileRef.current?.click()}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition",
          drag ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40",
        )}
      >
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        {uploading ? <Spinner className="h-8 w-8 text-brand-600" /> : <span className="text-4xl">📎</span>}
        <p className="mt-3 font-semibold">{k.dropFiles}</p>
        <p className="mt-1 text-xs text-muted">{k.fileTypes}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">🌐 {k.fromUrl}</h3>
          <div className="flex gap-2">
            <Input value={url} placeholder={k.urlPh} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && importUrl()} />
            <Button onClick={importUrl}>{k.import}</Button>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="mb-3 font-semibold">✍️ {k.addText}</h3>
          <Input value={text.title} placeholder={k.textTitle} onChange={(e) => setText({ ...text, title: e.target.value })} />
          <Textarea className="mt-2" value={text.content} placeholder={k.textBody} onChange={(e) => setText({ ...text, content: e.target.value })} />
          <Button className="mt-2" size="sm" onClick={addText}>
            {t.common.add}
          </Button>
        </Card>
      </div>

      <Card>
        <div className="border-b border-line px-5 py-4 font-semibold">{k.sources}</div>
        {!sources ? (
          <div className="flex justify-center py-10 text-brand-600">
            <Spinner />
          </div>
        ) : sources.length === 0 ? (
          <EmptyState icon="📚" title={k.empty} />
        ) : (
          <ul className="divide-y divide-line">
            {sources.map((s) => (
              <li key={s.id} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>{k.typeLabel[s.type]}</Badge>
                    <span className="truncate font-medium">{s.title}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {dateTime(s.createdAt, lang)} · {k.chars(s.chars)}
                    {s.status === "FAILED" && s.error && <span className="ml-1 text-red-600">— {s.error}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.status === "PROCESSING" && (
                    <Badge className="!bg-amber-100 !text-amber-700">
                      <Spinner className="h-3 w-3" /> {k.processing}
                    </Badge>
                  )}
                  {s.status === "READY" && <Badge className="!bg-emerald-100 !text-emerald-700">✓ {k.ready}</Badge>}
                  {s.status === "FAILED" && <Badge className="!bg-red-100 !text-red-700">{k.failed}</Badge>}
                  <Button size="sm" variant="ghost" onClick={() => open(s.id)}>
                    {k.view}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => confirm(t.common.confirmDelete) && del(`/knowledge/${s.id}`).then(() => Promise.all([reload(), refresh()]))}>
                    ✕
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.title} wide>
        {viewing && (
          <div>
            <Input value={viewing.title} onChange={(e) => setViewing({ ...viewing, title: e.target.value })} />
            <Textarea className="mt-3 min-h-[50vh] font-mono text-xs" value={viewing.content} onChange={(e) => setViewing({ ...viewing, content: e.target.value })} />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setViewing(null)}>
                {t.common.cancel}
              </Button>
              <Button onClick={saveViewing}>{t.common.save}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function KnowledgePage() {
  const { t, l } = useI18n();
  const k = t.dash.knowledge;
  const [tab, setTab] = useState<Tab>("profile");
  const [version, setVersion] = useState(0);
  const { data: biz, reload } = useApi<Business>("/business");
  const { data: types } = useApi<BusinessTypeDef[]>("/business-types");

  const tabs: Array<[Tab, string]> = [
    ["profile", k.tabs.profile],
    ["items", biz ? l(biz.typeDef.items.label) : k.tabs.items],
    ["faq", k.tabs.faq],
    ["files", k.tabs.files],
  ];

  return (
    <div>
      <PageHeader title={k.title} subtitle={k.subtitle} />
      {biz && (
        <Templates
          businessType={biz.businessType}
          onImported={() => {
            reload().then(() => setVersion((v) => v + 1));
          }}
        />
      )}
      <div className="scrollbar-thin mb-5 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cx("whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition", tab === key ? "bg-white text-ink shadow-sm" : "text-slate-600 hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>
      {!biz || !types ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner />
        </div>
      ) : (
        <>
          {tab === "profile" && <ProfileEditor key={`${biz.businessType}-${version}`} biz={biz} types={types} onSaved={reload} />}
          {tab === "items" && <ItemsEditor key={`${biz.businessType}-${version}`} biz={biz} onSaved={reload} />}
          {tab === "faq" && <FaqEditor key={version} biz={biz} onSaved={reload} />}
          {tab === "files" && <Sources />}
        </>
      )}
    </div>
  );
}
