"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Input, Label, PageHeader, PlatformIcon, Spinner, Toggle } from "@/components/ui";
import { ApiError, del, get, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx, date, dateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { ConnectedPage } from "@/lib/types";
import { WebsiteWidget } from "./WebsiteWidget";

interface Status {
  configured: boolean;
  igConfigured: boolean;
  webhookUrl: string;
  igRedirectUrl: string;
  fbRedirectUrl: string;
  verifyToken: string;
  account: { fbUserName: string | null } | null;
  pages: ConnectedPage[];
}

interface AvailablePage {
  id: string;
  name: string;
  category?: string;
  picture?: string;
  instagram: { id: string; username?: string } | null;
  connected: boolean;
  connectedElsewhere: boolean;
}

function Copy({ value }: { value: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <div className="flex gap-2">
      <Input readOnly value={value} className="font-mono text-xs" />
      <Button
        variant="outline"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }}
      >
        {done ? t.common.copied : t.common.copy}
      </Button>
    </div>
  );
}

function ChannelRow({ platform, label, sub, checked, onChange }: { platform: "FACEBOOK" | "INSTAGRAM"; label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className={cx("flex items-center justify-between gap-3 rounded-xl border p-3 transition", checked ? "border-brand-200 bg-brand-50/50" : "border-line")}>
      <div className="flex min-w-0 items-center gap-2.5">
        <PlatformIcon platform={platform} className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="truncate text-xs text-muted">{sub}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function ConnectionCard({ page, onChange }: { page: ConnectedPage; onChange: () => void }) {
  const { t, lang } = useI18n();
  const c = t.dash.channels;
  const { me } = useAuth();
  const [p, setP] = useState(page);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const commentsAllowed = me?.subscription.planDef.features.commentAutoReply;
  const isIgOnly = p.kind === "INSTAGRAM_LOGIN";

  async function update(data: Partial<ConnectedPage>) {
    setErr("");
    try {
      setP(await patch<ConnectedPage>(`/meta/pages/${p.id}`, data));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {p.pictureUrl ? <img src={p.pictureUrl} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <div className="h-11 w-11 rounded-xl bg-slate-100" />}
          <div>
            <p className="font-semibold">{isIgOnly ? `@${p.igUsername ?? p.name}` : p.name}</p>
            <Badge className="mt-0.5">
              <PlatformIcon platform={isIgOnly ? "INSTAGRAM" : "FACEBOOK"} className="h-3.5 w-3.5" />
              {isIgOnly ? c.viaIg : c.viaFb}
            </Badge>
          </div>
        </div>
        <Button
          size="sm"
          variant="danger"
          onClick={async () => {
            if (!confirm(t.common.confirmDelete)) return;
            await del(`/meta/pages/${p.id}`);
            onChange();
          }}
        >
          {c.disconnect}
        </Button>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{c.pickChannels}</p>
      <div className="space-y-2">
        {p.fbPageId && <ChannelRow platform="FACEBOOK" label={c.automateMessenger} sub={p.name} checked={p.fbEnabled} onChange={(v) => update({ fbEnabled: v })} />}
        {p.igAccountId ? (
          <ChannelRow platform="INSTAGRAM" label={c.automateInstagram} sub={`@${p.igUsername ?? ""}`} checked={p.igEnabled} onChange={(v) => update({ igEnabled: v })} />
        ) : (
          <p className="flex items-center gap-2 rounded-xl border border-dashed border-line p-3 text-xs text-muted">
            <PlatformIcon platform="INSTAGRAM" className="h-5 w-5 opacity-40" /> {c.noIg}
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        {p.lastSyncedAt && <span>{c.synced(dateTime(p.lastSyncedAt, lang))}</span>}
        {isIgOnly && p.tokenExpiresAt && <span>· {c.tokenExpires(date(p.tokenExpiresAt, lang))}</span>}
        <Button
          size="sm"
          variant="secondary"
          loading={busy === "sync"}
          onClick={async () => {
            setBusy("sync");
            await post(`/meta/pages/${p.id}/sync`).catch((e) => setErr(e.message));
            setBusy(null);
            onChange();
          }}
        >
          ↻ {c.sync}
        </Button>
      </div>

      <div className="mt-5 rounded-xl border border-line p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-medium">💬 {c.comments}</p>
            {!commentsAllowed && <p className="text-xs text-amber-600">{c.planNote}</p>}
          </div>
          <Toggle checked={p.commentAutoReply} disabled={!commentsAllowed} onChange={(v) => update({ commentAutoReply: v })} />
        </div>
        {p.commentAutoReply && (
          <div className="mt-4 space-y-3">
            <label className="block">
              <Label>{c.commentReply}</Label>
              <Input defaultValue={p.commentReplyText ?? ""} placeholder={c.commentReplyPh} onBlur={(e) => update({ commentReplyText: e.target.value || null })} />
            </label>
            <label className="block">
              <Label>{c.commentDm}</Label>
              <Input defaultValue={p.commentDmText ?? ""} placeholder={c.commentDmPh} onBlur={(e) => update({ commentDmText: e.target.value || null })} />
            </label>
          </div>
        )}
      </div>
      {err && (
        <Alert tone="error" className="mt-3">
          {err}
        </Alert>
      )}
    </Card>
  );
}

/** Facebook page picker: choose the page and which of its channels to automate. */
function PagePicker({ pages, onConnected }: { pages: AvailablePage[]; onConnected: () => void }) {
  const { t } = useI18n();
  const c = t.dash.channels;
  const [choice, setChoice] = useState<Record<string, { fb: boolean; ig: boolean }>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const pick = (id: string) => choice[id] ?? { fb: true, ig: true };

  async function connect(p: AvailablePage) {
    setBusy(p.id);
    setErr("");
    try {
      const ch = pick(p.id);
      await post("/meta/pages", { fbPageId: p.id, fbEnabled: ch.fb, igEnabled: ch.ig });
      onConnected();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mb-6 p-5">
      <h3 className="mb-3 font-semibold">{c.available}</h3>
      {err && (
        <Alert tone="error" className="mb-3">
          {err}
        </Alert>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {pages.map((p) => {
          const ch = pick(p.id);
          return (
            <div key={p.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.picture ? <img src={p.picture} alt="" className="h-10 w-10 rounded-lg" /> : <div className="h-10 w-10 rounded-lg bg-slate-100" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="truncate text-xs text-muted">{p.category}</p>
                </div>
                {p.connected && <Badge className="!bg-emerald-100 !text-emerald-700">✓ {c.connected}</Badge>}
                {p.connectedElsewhere && <Badge>{c.connectedElsewhere}</Badge>}
              </div>
              {!p.connected && !p.connectedElsewhere && (
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={ch.fb} onChange={(e) => setChoice({ ...choice, [p.id]: { ...ch, fb: e.target.checked } })} />
                    <PlatformIcon platform="FACEBOOK" className="h-4 w-4" /> Messenger
                  </label>
                  {p.instagram ? (
                    <label className="flex items-center gap-1.5">
                      <input type="checkbox" checked={ch.ig} onChange={(e) => setChoice({ ...choice, [p.id]: { ...ch, ig: e.target.checked } })} />
                      <PlatformIcon platform="INSTAGRAM" className="h-4 w-4" /> @{p.instagram.username}
                    </label>
                  ) : (
                    <span className="text-xs text-muted">{c.noIg}</span>
                  )}
                  <Button size="sm" className="ml-auto" onClick={() => connect(p)} loading={busy === p.id} disabled={!ch.fb && !(ch.ig && p.instagram)}>
                    {c.connect}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ChannelsInner() {
  const { t } = useI18n();
  const c = t.dash.channels;
  const { me, refresh } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const { data: status, reload } = useApi<Status>("/meta/status");
  const [available, setAvailable] = useState<AvailablePage[] | null>(null);
  const [err, setErr] = useState("");

  // Result of a Facebook / Instagram login redirect (?fb=connected | ?ig=connected | ?…=error&msg=…)
  const igResult = params.get("ig");
  const fbResult = params.get("fb");
  const result = igResult ?? fbResult;
  const [notice] = useState(() =>
    result === "connected"
      ? { tone: "success" as const, text: igResult ? c.igConnected : c.fbConnected }
      : result === "error"
        ? { tone: "error" as const, text: params.get("msg") ?? t.common.error }
        : null,
  );
  useEffect(() => {
    if (!result) return;
    refresh();
    router.replace("/dashboard/channels");
  }, [result, refresh, router]);

  // Right after Facebook login with nothing connected yet → show the page picker
  const needsPick = !!status?.account && !status.pages.some((p) => p.kind === "FACEBOOK_LOGIN");
  useEffect(() => {
    if (needsPick) get<AvailablePage[]>("/meta/available-pages").then(setAvailable).catch(() => undefined);
  }, [needsPick]);

  async function start(kind: "fb" | "ig") {
    setErr("");
    try {
      const r = await get<{ url: string }>(kind === "fb" ? "/meta/oauth-url" : "/meta/ig/oauth-url");
      window.location.assign(r.url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    }
  }

  async function loadAvailable() {
    setErr("");
    try {
      setAvailable(await get<AvailablePage[]>("/meta/available-pages"));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    }
  }

  if (!status) {
    return (
      <div className="flex justify-center py-20 text-brand-600">
        <Spinner />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={c.title} subtitle={c.subtitle} />
      {notice && (
        <Alert tone={notice.tone} className="mb-5">
          {notice.text}
        </Alert>
      )}
      {err && (
        <Alert tone="error" className="mb-5">
          {err}
        </Alert>
      )}

      <h2 className="text-lg font-bold">{c.chooseTitle}</h2>
      <p className="mb-4 text-sm text-muted">{c.chooseSub}</p>
      <div className="mb-8 grid gap-4 md:grid-cols-3">
        <Card className="flex flex-col p-5">
          <div className="flex items-center gap-3">
            <PlatformIcon platform="FACEBOOK" className="h-10 w-10" />
            <h3 className="text-lg font-bold">{c.fbCardTitle}</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted">{c.fbCardText}</p>
          {status.account && <p className="mt-3 text-xs text-emerald-700">✅ {c.connectedAs(status.account.fbUserName ?? "Facebook")}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => start("fb")} disabled={!status.configured} className="!bg-[#0866ff] hover:!bg-[#0757d6]">
              {status.account ? c.reconnect : c.connectFb}
            </Button>
            {status.account && (
              <Button variant="secondary" onClick={loadAvailable}>
                {c.pickPages}
              </Button>
            )}
          </div>
          {!status.configured && <p className="mt-2 text-xs text-amber-600">⚠️ {c.fbNotConfigured}</p>}
        </Card>

        <Card className="flex flex-col p-5">
          <div className="flex items-center gap-3">
            <PlatformIcon platform="INSTAGRAM" className="h-10 w-10" />
            <h3 className="text-lg font-bold">{c.igCardTitle}</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted">{c.igCardText}</p>
          <div className="mt-4">
            <Button onClick={() => start("ig")} disabled={!status.igConfigured} className="!bg-gradient-to-r !from-amber-500 !via-pink-500 !to-violet-600 hover:opacity-90">
              {c.connectIg}
            </Button>
          </div>
          {!status.igConfigured && <p className="mt-2 text-xs text-amber-600">⚠️ {c.igNotConfigured}</p>}
        </Card>

        <Card className="flex flex-col p-5">
          <div className="flex items-center gap-3">
            <PlatformIcon platform="WEB" className="h-10 w-10" />
            <h3 className="text-lg font-bold">{c.webCardTitle}</h3>
          </div>
          <p className="mt-2 flex-1 text-sm text-muted">{c.webCardText}</p>
          <div className="mt-4">
            <a href="#website" className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
              {c.webSetup} ↓
            </a>
          </div>
        </Card>
      </div>

      {available && (
        <PagePicker
          pages={available}
          onConnected={() => {
            reload();
            loadAvailable();
            refresh();
          }}
        />
      )}

      {status.pages.length > 0 && (
        <>
          <h2 className="mb-4 text-lg font-bold">{c.connections}</h2>
          <div className="grid gap-5 lg:grid-cols-2">
            {status.pages.map((p) => (
              <ConnectionCard key={`${p.id}-${p.kind}`} page={p} onChange={() => Promise.all([reload(), refresh()])} />
            ))}
          </div>
        </>
      )}

      <div className="mt-8">
        <WebsiteWidget businessName={me?.business.name ?? ""} />
      </div>

      <Card className="mt-8 p-5">
        <h3 className="mb-1 font-semibold">⚙️ Meta App тохиргоо</h3>
        <p className="mb-4 text-xs text-muted">
          Webhooks → Page (messages, messaging_postbacks, message_echoes, messaging_referrals, feed) + Instagram (messages, comments). {c.igWebhookNote}
        </p>
        <div className="space-y-3">
          <label className="block">
            <Label>{c.webhookUrl}</Label>
            <Copy value={status.webhookUrl} />
          </label>
          <label className="block">
            <Label>{c.verifyToken}</Label>
            <Copy value={status.verifyToken} />
          </label>
          <label className="block">
            <Label>{c.fbRedirect}</Label>
            <Copy value={status.fbRedirectUrl} />
          </label>
          <label className="block">
            <Label>{c.igRedirect}</Label>
            <Copy value={status.igRedirectUrl} />
          </label>
        </div>
      </Card>
    </div>
  );
}

export default function ChannelsView() {
  return (
    <Suspense>
      <ChannelsInner />
    </Suspense>
  );
}
