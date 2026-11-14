"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Label, Modal, PageHeader, PlatformIcon, Select, Spinner, Textarea } from "@/components/ui";
import { API_URL, ApiError, del, get, getToken, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx, dateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

interface AdsStatus {
  metaConfigured: boolean;
  connected: boolean;
  permission: boolean;
  pages: Array<{ id: string; name: string; fbPageId: string; igAccountId: string | null; igUsername: string | null; pictureUrl: string | null }>;
}

interface AdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
}

interface Targeting {
  ageMin: number;
  ageMax: number;
  gender: "MALE" | "FEMALE" | null;
  cities: string[];
  districts: string[];
  radiusKm: number;
}

interface Campaign {
  id: string;
  name: string;
  destination: "MESSENGER" | "INSTAGRAM_DIRECT";
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "FAILED" | "ARCHIVED";
  targeting: Targeting;
  dailyBudget: number;
  currency: string;
  startAt: string;
  endAt: string | null;
  primaryText: string;
  headline: string;
  imageUrl: string | null;
  metaStatus: string | null;
  stats: { impressions?: number; reach?: number; clicks?: number; spend?: number; conversations?: number };
  statsUpdatedAt: string | null;
  error: string | null;
  results: { chats: number; leads: number };
}

const nf = new Intl.NumberFormat("en-US");
const money = (v: number, cur: string) => `${nf.format(Math.round(v * 100) / 100)} ${cur}`;

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("rounded-full border px-2.5 py-1 text-xs font-medium transition", on ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-300")}
    >
      {children}
    </button>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h4 className="flex items-center gap-2 text-sm font-bold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs text-white">{n}</span>
        {title}
      </h4>
      {children}
    </section>
  );
}

function AdBuilder({ open, onClose, status, onCreated }: { open: boolean; onClose: () => void; status: AdsStatus; onCreated: () => void }) {
  const { t } = useI18n();
  const a = t.dash.ads;
  const ready = status.connected && status.permission && status.pages.length > 0;
  const { data: loc } = useApi<{ cities: string[]; districts: string[] }>("/locations");
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [f, setF] = useState(() => ({
    name: "",
    pageId: status.pages[0]?.id ?? "",
    destination: "MESSENGER" as Campaign["destination"],
    adAccountId: "",
    dailyBudget: 20000,
    startAt: toLocalInput(new Date(Date.now() + 15 * 60_000)),
    endAt: "",
    primaryText: "",
    headline: "",
  }));
  const [tg, setTg] = useState<Targeting>({ ageMin: 18, ageMax: 45, gender: null, cities: [], districts: [], radiusKm: 3 });
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open || !ready) return;
    get<AdAccount[]>("/ads/accounts")
      .then((list) => {
        setAccounts(list);
        if (list[0]) setF((x) => ({ ...x, adAccountId: x.adAccountId || list[0].id }));
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : t.common.error));
  }, [open, ready, t.common.error]);

  function pickImage(file: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  const page = status.pages.find((p) => p.id === f.pageId);
  const account = accounts?.find((x) => x.id === f.adAccountId);
  const currency = account?.currency ?? "USD";
  const days = useMemo(() => {
    if (!f.endAt) return null;
    const d = Math.ceil((new Date(f.endAt).getTime() - new Date(f.startAt).getTime()) / 86_400_000);
    return d > 0 ? d : null;
  }, [f.startAt, f.endAt]);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const allMongolia = !tg.cities.length && !tg.districts.length;

  async function runEstimate() {
    setBusy("estimate");
    setErr("");
    try {
      const r = await post<{ lower: number | null; upper: number | null }>("/ads/estimate", { adAccountId: f.adAccountId, destination: f.destination, targeting: tg });
      setEstimate(r.lower != null && r.upper != null ? a.estimateResult(nf.format(r.lower), nf.format(r.upper)) : "—");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setBusy(null);
    }
  }

  async function submit(activate: boolean) {
    if (!image) return setErr(a.imageHint);
    setBusy(activate ? "launch" : "draft");
    setErr("");
    const fd = new FormData();
    fd.append("image", image);
    fd.append(
      "data",
      JSON.stringify({
        name: f.name || f.headline || "Click-to-Message",
        pageId: f.pageId,
        adAccountId: f.adAccountId,
        currency,
        destination: f.destination,
        targeting: tg,
        dailyBudget: Number(f.dailyBudget),
        startAt: new Date(f.startAt).toISOString(),
        endAt: f.endAt ? new Date(f.endAt).toISOString() : null,
        primaryText: f.primaryText,
        headline: f.headline,
        activate,
      }),
    );
    try {
      const res = await fetch(`${API_URL}/api/ads`, { method: "POST", headers: { Authorization: `Bearer ${getToken()}` }, body: fd });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t.common.error);
      onCreated();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.common.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={a.new} wide>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-7">
          {!ready && <Alert tone="warn">{!status.connected || !status.permission ? a.needPermission : a.needPage}</Alert>}

          <Section n={1} title={a.step1}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label>{a.page}</Label>
                <Select value={f.pageId} onChange={(e) => setF({ ...f, pageId: e.target.value })}>
                  {status.pages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </label>
              <div>
                <Label>{a.destination}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["MESSENGER", "INSTAGRAM_DIRECT"] as const).map((d) => {
                    const disabled = d === "INSTAGRAM_DIRECT" && !page?.igAccountId;
                    return (
                      <button
                        key={d}
                        type="button"
                        disabled={disabled}
                        onClick={() => setF({ ...f, destination: d })}
                        className={cx(
                          "flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-semibold disabled:opacity-40",
                          f.destination === d ? "border-brand-500 bg-brand-50 text-brand-800" : "border-line",
                        )}
                      >
                        <PlatformIcon platform={d === "MESSENGER" ? "FACEBOOK" : "INSTAGRAM"} className="h-4 w-4" />
                        {d === "MESSENGER" ? a.messenger : a.instagram}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          <Section n={2} title={a.step2}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>{a.age}</Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={18} max={65} className="!h-9" value={tg.ageMin} onChange={(e) => setTg({ ...tg, ageMin: Number(e.target.value) })} />
                  <span className="text-muted">–</span>
                  <Input type="number" min={18} max={65} className="!h-9" value={tg.ageMax} onChange={(e) => setTg({ ...tg, ageMax: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <Label>{a.gender}</Label>
                <div className="flex gap-1.5">
                  <Chip on={!tg.gender} onClick={() => setTg({ ...tg, gender: null })}>
                    {t.dash.broadcasts.segment.any}
                  </Chip>
                  <Chip on={tg.gender === "MALE"} onClick={() => setTg({ ...tg, gender: "MALE" })}>
                    {t.dash.inbox.male}
                  </Chip>
                  <Chip on={tg.gender === "FEMALE"} onClick={() => setTg({ ...tg, gender: "FEMALE" })}>
                    {t.dash.inbox.female}
                  </Chip>
                </div>
              </div>
            </div>
            <div>
              <Label>{a.location}</Label>
              <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                <Chip on={allMongolia} onClick={() => setTg({ ...tg, cities: [], districts: [] })}>
                  🇲🇳 {a.allMongolia}
                </Chip>
                {(loc?.cities ?? [])
                  .filter((c) => c !== "Гадаад")
                  .map((c) => (
                    <Chip key={c} on={tg.cities.includes(c)} onClick={() => setTg({ ...tg, cities: toggle(tg.cities, c) })}>
                      {c}
                    </Chip>
                  ))}
              </div>
            </div>
            <div>
              <Label>{a.districts}</Label>
              <div className="flex flex-wrap items-center gap-1.5">
                {(loc?.districts ?? []).map((d) => (
                  <Chip key={d} on={tg.districts.includes(d)} onClick={() => setTg({ ...tg, districts: toggle(tg.districts, d) })}>
                    {d}
                  </Chip>
                ))}
                {tg.districts.length > 0 && (
                  <span className="ml-2 flex items-center gap-1.5 text-xs text-muted">
                    {a.radius}
                    <Input type="number" min={1} max={80} className="!h-8 w-16" value={tg.radiusKm} onChange={(e) => setTg({ ...tg, radiusKm: Number(e.target.value) })} />
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm" variant="secondary" onClick={runEstimate} loading={busy === "estimate"} disabled={!ready || !f.adAccountId}>
                👥 {a.estimate}
              </Button>
              {estimate && <span className="text-sm font-semibold text-brand-800">{estimate}</span>}
            </div>
          </Section>

          <Section n={3} title={a.step3}>
            <label className="block">
              <Label hint={`(${a.imageHint})`}>{a.image}</Label>
              <input type="file" accept="image/png,image/jpeg" onChange={(e) => pickImage(e.target.files?.[0] ?? null)} className="text-sm" />
            </label>
            <label className="block">
              <Label>{a.primaryText}</Label>
              <Textarea value={f.primaryText} placeholder={a.primaryTextPh} maxLength={2000} onChange={(e) => setF({ ...f, primaryText: e.target.value })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label>{a.headline}</Label>
                <Input value={f.headline} placeholder={a.headlinePh} maxLength={100} onChange={(e) => setF({ ...f, headline: e.target.value })} />
              </label>
              <label className="block">
                <Label>{a.name}</Label>
                <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </label>
            </div>
          </Section>

          <Section n={4} title={a.step4}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <Label>{a.account}</Label>
                {accounts && !accounts.length ? (
                  <p className="text-xs text-amber-700">{a.noAccounts}</p>
                ) : (
                  <Select value={f.adAccountId} onChange={(e) => setF({ ...f, adAccountId: e.target.value })} disabled={!accounts}>
                    {(accounts ?? []).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name} ({x.currency})
                      </option>
                    ))}
                  </Select>
                )}
              </label>
              <label className="block">
                <Label hint={`(${currency})`}>{a.dailyBudget}</Label>
                <Input type="number" min={1} value={f.dailyBudget} onChange={(e) => setF({ ...f, dailyBudget: Number(e.target.value) })} />
              </label>
              <label className="block">
                <Label>{a.start}</Label>
                <Input type="datetime-local" value={f.startAt} onChange={(e) => setF({ ...f, startAt: e.target.value })} />
              </label>
              <label className="block">
                <Label>{a.end}</Label>
                <Input type="datetime-local" value={f.endAt} onChange={(e) => setF({ ...f, endAt: e.target.value })} />
              </label>
            </div>
            {days && <p className="text-xs text-muted">{a.total(money(f.dailyBudget * days, currency))}</p>}
          </Section>

          {err && <Alert tone="error">{err}</Alert>}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line pt-4">
            <p className="mr-auto text-xs text-muted">ⓘ {a.reviewNote}</p>
            <Button variant="outline" onClick={() => submit(false)} loading={busy === "draft"} disabled={!ready || !image || !f.primaryText || !f.headline || !f.adAccountId}>
              {a.saveDraft}
            </Button>
            <Button onClick={() => submit(true)} loading={busy === "launch"} disabled={!ready || !image || !f.primaryText || !f.headline || !f.adAccountId}>
              🚀 {a.launch}
            </Button>
          </div>
        </div>

        {/* Ad preview (feed style) */}
        <div className="lg:sticky lg:top-0">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{a.preview}</p>
          <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <div className="flex items-center gap-2 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {page?.pictureUrl ? <img src={page.pictureUrl} alt="" className="h-9 w-9 rounded-full" /> : <div className="h-9 w-9 rounded-full bg-brand-100" />}
              <div>
                <p className="text-sm font-semibold">{f.destination === "INSTAGRAM_DIRECT" && page?.igUsername ? page.igUsername : (page?.name ?? "Your page")}</p>
                <p className="text-[11px] text-muted">{a.sponsored}</p>
              </div>
            </div>
            <p className="whitespace-pre-wrap px-3 pb-2 text-sm">{f.primaryText || a.primaryTextPh}</p>
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="aspect-square w-full object-cover" />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-canvas text-4xl">🖼️</div>
            )}
            <div className="flex items-center justify-between gap-2 bg-slate-50 p-3">
              <p className="min-w-0 truncate text-sm font-semibold">{f.headline || a.headlinePh}</p>
              <span className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold">
                <PlatformIcon platform={f.destination === "MESSENGER" ? "FACEBOOK" : "INSTAGRAM"} className="h-3.5 w-3.5" />
                {a.sendMessage}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function CampaignCard({ c, onChange }: { c: Campaign; onChange: () => void }) {
  const { t, lang } = useI18n();
  const a = t.dash.ads;
  const [busy, setBusy] = useState<string | null>(null);
  const s = c.stats ?? {};
  const conv = s.conversations ?? 0;
  const tgt = c.targeting;
  const chips = [
    `${tgt.ageMin}–${tgt.ageMax}`,
    tgt.gender ? (tgt.gender === "MALE" ? t.dash.inbox.male : t.dash.inbox.female) : null,
    !tgt.cities.length && !tgt.districts.length ? a.allMongolia : null,
    ...tgt.cities,
    ...tgt.districts.map((d) => `${d} (${tgt.radiusKm}км)`),
  ].filter(Boolean) as string[];

  async function act(kind: string, fn: () => Promise<unknown>) {
    setBusy(kind);
    await fn().catch(() => undefined);
    setBusy(null);
    onChange();
  }

  const stats: Array<[string, string]> = [
    [a.stats.impressions, nf.format(s.impressions ?? 0)],
    [a.stats.reach, nf.format(s.reach ?? 0)],
    [a.stats.clicks, nf.format(s.clicks ?? 0)],
    [a.stats.spend, money(s.spend ?? 0, c.currency)],
    [a.stats.conversations, nf.format(conv)],
    [a.stats.chats, nf.format(c.results.chats)],
    [a.stats.leads, nf.format(c.results.leads)],
    [a.stats.costPerChat, conv ? money((s.spend ?? 0) / conv, c.currency) : "—"],
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {c.imageUrl ? <img src={c.imageUrl} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-canvas text-3xl">📣</div>}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <PlatformIcon platform={c.destination === "MESSENGER" ? "FACEBOOK" : "INSTAGRAM"} className="h-5 w-5" />
            <p className="font-semibold">{c.name}</p>
            <Badge
              className={cx(
                c.status === "ACTIVE" && "!bg-emerald-100 !text-emerald-700",
                c.status === "PAUSED" && "!bg-amber-100 !text-amber-700",
                c.status === "FAILED" && "!bg-red-100 !text-red-700",
              )}
            >
              {a.statuses[c.status]}
            </Badge>
            {c.metaStatus && c.metaStatus !== c.status && <Badge>Meta: {c.metaStatus}</Badge>}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{c.primaryText}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {chips.map((x) => (
              <Badge key={x} className="!bg-amber-50 !text-amber-800">
                🎯 {x}
              </Badge>
            ))}
            <Badge>
              💰 {money(c.dailyBudget, c.currency)}
              {a.perDay}
            </Badge>
          </div>
          {c.error && <p className="mt-2 text-xs text-red-600">{c.error}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 sm:flex-col">
          {c.status === "ACTIVE" && (
            <Button size="sm" variant="outline" loading={busy === "pause"} onClick={() => act("pause", () => post(`/ads/${c.id}/status`, { status: "PAUSED" }))}>
              ⏸ {a.pause}
            </Button>
          )}
          {c.status === "PAUSED" && (
            <Button size="sm" variant="secondary" loading={busy === "resume"} onClick={() => act("resume", () => post(`/ads/${c.id}/status`, { status: "ACTIVE" }))}>
              ▶ {a.resume}
            </Button>
          )}
          {c.status !== "FAILED" && (
            <Button size="sm" variant="ghost" loading={busy === "sync"} onClick={() => act("sync", () => post(`/ads/${c.id}/sync`))}>
              ↻ {a.refresh}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={() => confirm(t.common.confirmDelete) && act("del", () => del(`/ads/${c.id}`))}>
            ✕
          </Button>
        </div>
      </div>
      {c.status !== "FAILED" && (
        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
          {stats.map(([label, value]) => (
            <div key={label} className="bg-white px-3 py-2.5">
              <p className="text-[11px] text-muted">{label}</p>
              <p className="text-base font-bold tabular-nums">{value}</p>
            </div>
          ))}
        </div>
      )}
      {c.statsUpdatedAt && <p className="mt-2 text-right text-[11px] text-slate-400">{a.updated(dateTime(c.statsUpdatedAt, lang))}</p>}
    </Card>
  );
}

export default function AdsPage() {
  const { t } = useI18n();
  const a = t.dash.ads;
  const { refresh } = useAuth();
  const { data: status } = useApi<AdsStatus>("/ads/status");
  const { data: list, reload } = useApi<Campaign[]>("/ads");
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");

  async function connect() {
    setErr("");
    try {
      const r = await get<{ url: string }>("/meta/oauth-url?ads=1");
      window.location.assign(r.url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    }
  }

  return (
    <div>
      <PageHeader title={a.title} subtitle={a.subtitle} actions={<Button onClick={() => setOpen(true)}>+ {a.new}</Button>} />

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-semibold">💡 {a.whyTitle}</p>
        <p className="mt-1 leading-relaxed">{a.why}</p>
      </div>

      {err && (
        <Alert tone="error" className="mb-5">
          {err}
        </Alert>
      )}

      {status && (
        <>
          {!status.metaConfigured && (
            <Alert tone="warn" className="mb-5">
              {a.notConfigured}
            </Alert>
          )}
          {status.metaConfigured && (!status.connected || !status.permission) && (
            <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
              <p className="text-sm">{a.needPermission}</p>
              <Button onClick={connect} className="!bg-[#0866ff] hover:!bg-[#0757d6]">
                <PlatformIcon platform="FACEBOOK" className="h-5 w-5 rounded-full bg-white" />
                {status.connected ? a.grant : a.connect}
              </Button>
            </Card>
          )}
          {status.connected && !status.pages.length && (
            <Alert tone="warn" className="mb-5">
              {a.needPage}{" "}
              <Link href="/dashboard/channels" className="font-semibold underline">
                {t.dash.nav.channels} →
              </Link>
            </Alert>
          )}
        </>
      )}

      {!list ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon="📣" title={a.empty} action={<Button onClick={() => setOpen(true)}>+ {a.new}</Button>} />
        </Card>
      ) : (
        <div className="space-y-4">
          {list.map((c) => (
            <CampaignCard key={c.id} c={c} onChange={reload} />
          ))}
        </div>
      )}

      {status && open && (
        <AdBuilder
          open={open}
          onClose={() => setOpen(false)}
          status={status}
          onCreated={() => {
            reload();
            refresh();
          }}
        />
      )}
    </div>
  );
}
