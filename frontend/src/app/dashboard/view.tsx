"use client";

import Link from "next/link";
import { Badge, Card, PageHeader, PlatformIcon, Progress, Spinner } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { Business, KnowledgeSource } from "@/lib/types";

interface Analytics {
  contactsTotal: number;
  newContacts: number;
  platforms: Record<string, number>;
  inbound: number;
  botReplies: number;
  automationRate: number;
  leads: number;
  needsHuman: number;
  topTags: Array<{ id: string; name: string; color: string; count: number }>;
  series: Array<{ date: string; inbound: number; bot: number }>;
}

function Chart({ series }: { series: Analytics["series"] }) {
  const max = Math.max(1, ...series.map((s) => Math.max(s.inbound, s.bot)));
  return (
    <div className="flex h-44 items-end gap-[3px]">
      {series.map((s) => (
        <div key={s.date} className="group relative flex h-full flex-1 items-end gap-[1px]" title={`${s.date}: ${s.inbound} / ${s.bot}`}>
          <div className="w-1/2 rounded-t bg-brand-200 transition group-hover:bg-brand-300" style={{ height: `${(s.inbound / max) * 100}%`, minHeight: s.inbound ? 2 : 0 }} />
          <div className="w-1/2 rounded-t bg-brand-600 transition group-hover:bg-brand-700" style={{ height: `${(s.bot / max) * 100}%`, minHeight: s.bot ? 2 : 0 }} />
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const { me } = useAuth();
  const { t } = useI18n();
  const o = t.dash.overview;
  const { data: a } = useApi<Analytics>("/analytics?days=30");
  const { data: biz } = useApi<Business>("/business");
  const { data: sources } = useApi<KnowledgeSource[]>("/knowledge");
  const { data: pg } = useApi<{ messages: unknown[] }>("/playground");
  const { data: meta } = useApi<{ pages: unknown[] }>("/meta/status");
  if (!me) return null;
  const sub = me.subscription;

  const filledFields = biz ? Object.values(biz.profile.fields).filter((v) => v?.trim()).length + biz.profile.items.length : 0;
  const steps = [
    { label: o.setupSteps.pay, done: sub.status === "ACTIVE", href: "/dashboard/billing" },
    { label: o.setupSteps.info, done: filledFields >= 3 || (sources?.length ?? 0) > 0, href: "/dashboard/knowledge" },
    { label: o.setupSteps.connect, done: (meta?.pages.length ?? 0) > 0, href: "/dashboard/channels" },
    { label: o.setupSteps.test, done: (pg?.messages.length ?? 0) > 0, href: "/dashboard/bot" },
  ];
  const doneCount = steps.filter((s) => s.done).length;

  const stats = a
    ? [
        { label: o.stats.inbound, value: a.inbound },
        { label: o.stats.bot, value: a.botReplies },
        { label: o.stats.automation, value: `${a.automationRate}%` },
        { label: o.stats.leads, value: a.leads, href: "/dashboard/leads" },
        { label: o.stats.contacts, value: a.contactsTotal, href: "/dashboard/contacts" },
        { label: o.stats.needsHuman, value: a.needsHuman, href: "/dashboard/inbox?filter=human", alert: a.needsHuman > 0 },
      ]
    : [];

  const usage = [
    { label: o.aiReplies, ...sub.usage.aiReplies },
    { label: o.pages, ...sub.usage.pages },
    { label: o.files, ...sub.usage.knowledgeFiles },
    { label: o.broadcasts, ...sub.usage.broadcasts },
  ];

  return (
    <div>
      <PageHeader
        title={o.hello(me.user.name.split(" ")[0])}
        subtitle={o.subtitle}
        actions={
          <Link href="/dashboard/analytics" className="inline-flex h-10 items-center rounded-xl bg-brand-50 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-100">
            📊 {t.dash.nav.analytics} →
          </Link>
        }
      />

      {doneCount < steps.length && (
        <Card className="mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{o.setup}</h2>
            <span className="text-sm text-muted">
              {doneCount}/{steps.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <Link
                key={s.label}
                href={s.href}
                className={cx(
                  "flex items-center gap-3 rounded-xl border p-3 text-sm transition",
                  s.done ? "border-emerald-200 bg-emerald-50/60" : "border-line hover:border-brand-300 hover:bg-brand-50/40",
                )}
              >
                <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold", s.done ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500")}>
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={cx("font-medium", s.done && "text-emerald-800")}>{s.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {!a ? (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {stats.map((s) => {
              const inner = (
                <Card className={cx("h-full p-4", s.alert && "border-amber-300 bg-amber-50")}>
                  <p className="text-xs text-muted">{s.label}</p>
                  <p className="mt-1 text-2xl font-bold tracking-tight">{s.value}</p>
                </Card>
              );
              return s.href ? (
                <Link key={s.label} href={s.href} className="transition hover:-translate-y-0.5">
                  {inner}
                </Link>
              ) : (
                <div key={s.label}>{inner}</div>
              );
            })}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="p-5 lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">{o.chart}</h2>
                <div className="flex items-center gap-4 text-xs text-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand-200" />
                    {o.stats.inbound}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />
                    {o.stats.bot}
                  </span>
                  <span>{o.last30}</span>
                </div>
              </div>
              <Chart series={a.series} />
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-semibold">{o.usage}</h2>
              <div className="space-y-4">
                {usage.map((u) => (
                  <div key={u.label}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="text-slate-600">{u.label}</span>
                      <span className="font-medium">
                        {u.used.toLocaleString()} / {u.limit === null ? "∞" : u.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={u.used} max={u.limit} />
                  </div>
                ))}
              </div>
              <Link href="/dashboard/billing" className="mt-5 block text-center text-sm font-semibold text-brand-600 hover:underline">
                {t.common.upgrade} →
              </Link>
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-semibold">{o.topTags}</h2>
              {a.topTags.length ? (
                <div className="space-y-2.5">
                  {a.topTags.map((tg) => (
                    <div key={tg.id} className="flex items-center justify-between">
                      <Badge color={tg.color}>{tg.name}</Badge>
                      <span className="text-sm font-medium">{tg.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted">{t.common.none}</p>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="mb-4 font-semibold">{o.channels}</h2>
              <div className="space-y-3">
                {(["FACEBOOK", "INSTAGRAM", "WEB"] as const).map((p) => (
                  <div key={p} className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm">
                      <PlatformIcon platform={p} className="h-5 w-5" />
                      {t.dash.analytics.channelNames[p]}
                    </span>
                    <span className="font-semibold">{a.platforms[p] ?? 0}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
