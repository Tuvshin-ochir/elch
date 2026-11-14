"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Alert, Avatar, Badge, Button, Card, EmptyState, Input, Select, Spinner, Textarea } from "@/components/ui";
import { API_URL, ApiError, del, get, getToken, patch, post } from "@/lib/api";
import { cx, dateTime, timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { useNow } from "@/lib/useNow";
import type { Contact, Lead, Message, Tag } from "@/lib/types";

type Filter = "all" | "human" | "fb" | "ig" | "web";

/** Live updates via Server-Sent Events */
function useEvents(onEvent: (e: { type: string; contactId?: string; message?: Message }) => void) {
  const ref = useRef(onEvent);
  useEffect(() => {
    ref.current = onEvent;
  });
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`${API_URL}/api/events?token=${encodeURIComponent(token)}`);
    es.onmessage = (ev) => {
      try {
        ref.current(JSON.parse(ev.data));
      } catch {
        /* ignore */
      }
    };
    return () => es.close();
  }, []);
}

function Thread({ contactId, tags, onChanged }: { contactId: string; tags: Tag[]; onChanged: () => void }) {
  const { t, lang } = useI18n();
  const i = t.dash.inbox;
  const [contact, setContact] = useState<(Contact & { leads: Lead[] }) | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [missing, setMissing] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const now = useNow();

  const load = useCallback(async () => {
    const [c, m] = await Promise.all([get<Contact & { leads: Lead[] }>(`/contacts/${contactId}`), get<Message[]>(`/contacts/${contactId}/messages`)]);
    setContact(c);
    setMessages(m);
    if (c.unread) post(`/contacts/${contactId}/read`).then(onChanged);
  }, [contactId, onChanged]);

  useEffect(() => {
    Promise.all([get<Contact & { leads: Lead[] }>(`/contacts/${contactId}`), get<Message[]>(`/contacts/${contactId}/messages`)])
      .then(([c, m]) => {
        setContact(c);
        setMessages(m);
        if (c.unread) post(`/contacts/${contactId}/read`).then(onChanged);
      })
      .catch(() => setMissing(true));
  }, [contactId, onChanged]);

  useEvents((e) => {
    if (e.contactId !== contactId) return;
    if (e.type === "message" && e.message) {
      setMessages((ms) => (ms.some((x) => x.id === e.message!.id) ? ms : [...ms, e.message!]));
      post(`/contacts/${contactId}/read`);
    } else load();
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (missing) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50">
        <EmptyState icon="🔍" title={t.common.error} />
      </div>
    );
  }
  if (!contact) {
    return (
      <div className="flex flex-1 items-center justify-center text-brand-600">
        <Spinner />
      </div>
    );
  }

  const paused = !!contact.botPausedUntil && new Date(contact.botPausedUntil).getTime() > now;
  const inWindow = contact.platform === "WEB" || (!!contact.lastInboundAt && now - new Date(contact.lastInboundAt).getTime() < 24 * 3600 * 1000);

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    setErr("");
    try {
      const m = await post<Message>(`/contacts/${contactId}/messages`, { text });
      setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m]));
      setText("");
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    } finally {
      setSending(false);
    }
  }

  async function setBot(pausedNext: boolean) {
    await post(`/contacts/${contactId}/bot`, { paused: pausedNext });
    load();
    onChanged();
  }

  async function addTag(tagId: string) {
    if (!tagId) return;
    await post(`/contacts/${contactId}/tags`, { tagId });
    load();
    onChanged();
  }

  async function removeTag(tagId: string) {
    await del(`/contacts/${contactId}/tags/${tagId}`);
    load();
    onChanged();
  }

  const senderStyle: Record<Message["sender"], string> = {
    CUSTOMER: "bg-white border border-line",
    BOT: "bg-brand-600 text-white",
    AGENT: "bg-emerald-600 text-white",
    BROADCAST: "bg-teal-600 text-white",
    SYSTEM: "bg-slate-200",
  };

  return (
    <div className="flex min-w-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar src={contact.profilePic} name={contact.name} platform={contact.platform} />
            <div className="min-w-0">
              <p className="truncate font-semibold">{contact.name ?? contact.username ?? contact.externalId}</p>
              <p className="flex items-center gap-2 text-xs text-muted">
                <span className={cx("h-1.5 w-1.5 rounded-full", inWindow ? "bg-emerald-500" : "bg-slate-300")} />
                {contact.platform === "WEB" ? t.dash.analytics.channelNames.WEB : inWindow ? i.windowOpen : i.windowClosed}
                {contact.page && <span className="hidden sm:inline">· {contact.page.name}</span>}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {paused ? (
              <Button size="sm" variant="secondary" onClick={() => setBot(false)}>
                ▶ {i.resumeBot}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setBot(true)}>
                ⏸ {i.pauseBot}
              </Button>
            )}
            <Button size="sm" variant="ghost" className="xl:hidden" onClick={() => setShowInfo(!showInfo)}>
              ⓘ
            </Button>
          </div>
        </div>

        <div className="scrollbar-thin flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
          {messages.map((m) => (
            <div key={m.id} className={cx("flex flex-col", m.direction === "IN" ? "items-start" : "items-end")}>
              <div className={cx("max-w-[80%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-sm", senderStyle[m.sender])}>
                {m.attachments?.images?.map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={src} src={src} alt="" className="mb-1.5 max-h-48 rounded-lg" />
                ))}
                {m.text}
              </div>
              <span className="mt-1 px-1 text-[11px] text-slate-400">
                {i.sender[m.sender]} · {dateTime(m.createdAt, lang)}
                {m.error && <span className="ml-1 text-red-500">· {i.sendFailed}</span>}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-line bg-white p-3">
          {err && (
            <Alert tone="error" className="mb-2 text-xs">
              {err}
            </Alert>
          )}
          <div className="flex gap-2">
            <Textarea
              className="!min-h-[44px] flex-1 resize-none"
              rows={1}
              value={text}
              placeholder={i.replyPh}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button onClick={send} loading={sending} disabled={!text.trim()}>
              {t.common.send}
            </Button>
          </div>
          <p className="mt-1.5 px-1 text-[11px] text-slate-400">{i.replyHint}</p>
        </div>
      </div>

      <aside className={cx("w-72 shrink-0 overflow-y-auto border-l border-line bg-white p-4", showInfo ? "block" : "hidden xl:block")}>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{i.contactInfo}</p>
        <div className="space-y-2 text-sm">
          {contact.needsHuman && <Badge className="!bg-amber-100 !text-amber-700">🙋 {i.needsHuman}</Badge>}
          {paused && <Badge className="ml-1 !bg-slate-200">⏸ {i.botPaused}</Badge>}
          <ContactField key={`p-${contact.phone}`} label={t.common.phone} value={contact.phone} onSave={(v) => patch(`/contacts/${contactId}`, { phone: v || null }).then(load)} />
          <ContactField key={`n-${contact.notes}`} label={t.common.notes} value={contact.notes} multiline onSave={(v) => patch(`/contacts/${contactId}`, { notes: v || null }).then(load)} />
        </div>

        <ProfileFields contact={contact} onSaved={load} />

        <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">Tags</p>
        <div className="flex flex-wrap gap-1.5">
          {contact.tags.map((tg) => (
            <Badge key={tg.id} color={tg.color}>
              {tg.name}
              <button onClick={() => removeTag(tg.id)} className="ml-0.5 opacity-60 hover:opacity-100">
                ×
              </button>
            </Badge>
          ))}
        </div>
        <Select className="mt-2 !h-9" value="" onChange={(e) => addTag(e.target.value)}>
          <option value="">+ {i.addTag}</option>
          {tags
            .filter((tg) => !contact.tags.some((x) => x.id === tg.id))
            .map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.name}
              </option>
            ))}
        </Select>

        {contact.leads.length > 0 && (
          <>
            <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{t.dash.nav.leads}</p>
            <div className="space-y-2">
              {contact.leads.map((l) => (
                <div key={l.id} className="rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-900">
                  <p className="font-semibold">{t.dash.leads.types[l.type]}</p>
                  <p className="mt-0.5">{l.details}</p>
                  <p className="mt-1 text-emerald-700">{timeAgo(l.createdAt, lang)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/** Age / gender / location — used to segment scheduled messages. */
function ProfileFields({ contact, onSaved }: { contact: Contact; onSaved: () => void }) {
  const { t } = useI18n();
  const i = t.dash.inbox;
  const { data: loc } = useApi<{ cities: string[]; districts: string[] }>("/locations");
  const age = contact.birthYear ? new Date().getFullYear() - contact.birthYear : null;
  const save = (data: Record<string, unknown>) => patch(`/contacts/${contact.id}`, data).then(onSaved);
  return (
    <div className="mt-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{i.profile}</p>
      <p className="mb-2 text-[11px] text-slate-400">✨ {i.profileHint}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs text-muted">{i.age}</span>
          <Input
            key={`age-${age}`}
            type="number"
            min={1}
            max={120}
            className="mt-1 !h-9"
            defaultValue={age ?? ""}
            placeholder="—"
            onBlur={(e) => {
              const v = e.target.value ? Number(e.target.value) : null;
              if (v !== age) save({ age: v });
            }}
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">{i.gender}</span>
          <Select className="mt-1 !h-9" value={contact.gender ?? ""} onChange={(e) => save({ gender: e.target.value || null })}>
            <option value="">{i.unknown}</option>
            <option value="MALE">{i.male}</option>
            <option value="FEMALE">{i.female}</option>
          </Select>
        </label>
        <label className="col-span-2 block">
          <span className="text-xs text-muted">{i.city}</span>
          <Select className="mt-1 !h-9" value={contact.city ?? ""} onChange={(e) => save({ city: e.target.value || null, ...(e.target.value !== "Улаанбаатар" ? { district: null } : {}) })}>
            <option value="">{i.unknown}</option>
            {loc?.cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </label>
        {(!contact.city || contact.city === "Улаанбаатар") && (
          <label className="col-span-2 block">
            <span className="text-xs text-muted">{i.district}</span>
            <Select className="mt-1 !h-9" value={contact.district ?? ""} onChange={(e) => save({ district: e.target.value || null })}>
              <option value="">{i.unknown}</option>
              {loc?.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>
    </div>
  );
}

function ContactField({ label, value, onSave, multiline }: { label: string; value: string | null; onSave: (v: string) => void; multiline?: boolean }) {
  const [v, setV] = useState(value ?? "");
  const props = { value: v, onChange: (e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => setV(e.target.value), onBlur: () => v !== (value ?? "") && onSave(v) };
  return (
    <label className="block">
      <span className="text-xs text-muted">{label}</span>
      {multiline ? <Textarea className="mt-1 !min-h-[70px] text-xs" {...props} /> : <Input className="mt-1 !h-9" {...props} />}
    </label>
  );
}

function InboxInner() {
  const { t, lang } = useI18n();
  const i = t.dash.inbox;
  const params = useSearchParams();
  const [filter, setFilter] = useState<Filter>((params.get("filter") as Filter) ?? "all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(params.get("contact"));
  const { data: tags } = useApi<Tag[]>("/tags");
  const now = useNow();

  const query = new URLSearchParams({ take: "100" });
  if (filter === "human") query.set("needsHuman", "true");
  if (filter === "fb") query.set("platform", "FACEBOOK");
  if (filter === "ig") query.set("platform", "INSTAGRAM");
  if (filter === "web") query.set("platform", "WEB");
  if (search) query.set("search", search);
  const { data, reload } = useApi<{ items: Contact[]; total: number }>(`/contacts?${query}`);

  useEvents(() => reload());

  return (
    <Card className="-mx-4 flex h-[calc(100vh-7.5rem)] overflow-hidden rounded-none border-x-0 sm:mx-0 sm:rounded-2xl sm:border-x lg:h-[calc(100vh-4rem)]">
      <div className={cx("flex w-full shrink-0 flex-col border-r border-line md:w-80", selected && "hidden md:flex")}>
        <div className="space-y-2 border-b border-line p-3">
          <Input placeholder={`🔎 ${t.common.search}`} value={search} onChange={(e) => setSearch(e.target.value)} />
          <div className="scrollbar-thin flex gap-1 overflow-x-auto text-xs">
            {(Object.keys(i.filters) as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cx("whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium", filter === f ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}
              >
                {i.filters[f]}
              </button>
            ))}
          </div>
        </div>
        <div className="scrollbar-thin flex-1 overflow-y-auto">
          {!data ? (
            <div className="flex justify-center py-10 text-brand-600">
              <Spinner />
            </div>
          ) : data.items.length === 0 ? (
            <EmptyState icon="💬" title={i.empty} text={i.emptyHint} action={<Link href="/dashboard/channels" className="text-sm font-semibold text-brand-600">{t.dash.nav.channels} →</Link>} />
          ) : (
            data.items.map((c) => {
              const paused = !!c.botPausedUntil && new Date(c.botPausedUntil).getTime() > now;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.id)}
                  className={cx("flex w-full items-start gap-3 border-b border-line/60 px-3 py-3 text-left transition", selected === c.id ? "bg-brand-50" : "hover:bg-slate-50")}
                >
                  <Avatar src={c.profilePic} name={c.name} platform={c.platform} size={40} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cx("truncate text-sm", c.unread ? "font-bold" : "font-medium")}>{c.name ?? c.username ?? "—"}</p>
                      <span className="shrink-0 text-[11px] text-slate-400">{timeAgo(c.lastMessageAt, lang)}</span>
                    </div>
                    <p className={cx("truncate text-xs", c.unread ? "text-ink" : "text-muted")}>{c.lastMessageText}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {c.needsHuman && <Badge className="!bg-amber-100 !px-1.5 !text-[10px] !text-amber-700">🙋 {i.needsHuman}</Badge>}
                      {paused && <Badge className="!px-1.5 !text-[10px]">⏸</Badge>}
                      {c.tags.slice(0, 3).map((tg) => (
                        <Badge key={tg.id} color={tg.color} className="!px-1.5 !text-[10px]">
                          {tg.name}
                        </Badge>
                      ))}
                      {c.unread > 0 && <span className="ml-auto rounded-full bg-brand-600 px-1.5 text-[10px] font-bold text-white">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className={cx("min-w-0 flex-1 flex-col", selected ? "flex" : "hidden md:flex")}>
        {selected ? (
          <>
            <button className="border-b border-line px-4 py-2 text-left text-sm font-medium text-brand-600 md:hidden" onClick={() => setSelected(null)}>
              ← {t.common.back}
            </button>
            <Thread key={selected} contactId={selected} tags={tags ?? []} onChanged={reload} />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center bg-slate-50">
            <EmptyState icon="📨" title={i.select} />
          </div>
        )}
      </div>
    </Card>
  );
}

export default function InboxPage() {
  return (
    <Suspense>
      <InboxInner />
    </Suspense>
  );
}
