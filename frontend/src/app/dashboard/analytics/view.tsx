"use client";

import { useState } from "react";
import { BarList, Funnel, Heatmap, Legend, LineChart, StatTile } from "@/components/charts";
import { Badge, Button, Card, PageHeader, PlatformIcon, Progress, Spinner } from "@/components/ui";
import { API_URL, getToken } from "@/lib/api";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";

interface Totals {
  inbound: number;
  bot: number;
  agent: number;
  broadcast: number;
  newContacts: number;
  leads: number;
  automationRate: number;
  conversionRate: number;
}

interface Full {
  days: number;
  current: Totals;
  previous: Totals;
  series: Array<{ date: string; inbound: number; bot: number; agent: number; broadcast: number; newContacts: number; leads: number }>;
  platforms: { messages: Record<string, number>; contacts: Record<string, number> };
  heatmap: number[][];
  responseTime: { bot: { count: number; avgSeconds: number | null; buckets: number[] }; agent: { count: number; avgSeconds: number | null; buckets: number[] } };
  funnel: { newContacts: number; engaged: number; withLead: number; done: number };
  leads: { byType: Record<string, number>; byStatus: Record<string, number> };
  tags: Array<{ id: string; name: string; color: string; count: number }>;
  tagSources: Record<string, number>;
  broadcasts: Array<{ id: string; name: string; type: string; status: string; sentCount: number; failedCount: number; skippedCount: number }>;
  topWords: Array<{ word: string; count: number }>;
  usage: { aiReplies: number; limit: number };
}

const RANGES = [7, 30, 90];
const S1 = "var(--color-series-1)";
const S2 = "var(--color-series-2)";
const S3 = "var(--color-series-3)";

function Panel({ title, hint, children, className, right }: { title: string; hint?: string; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <Card className={cx("p-5", className)}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {hint && <p className="text-xs text-muted">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

export default function AnalyticsPage() {
  const { t, lang } = useI18n();
  const a = t.dash.analytics;
  const [days, setDays] = useState(30);
  const [table, setTable] = useState(false);
  const { data } = useApi<Full>(`/analytics/full?days=${days}`);
  const shortDate = (d: string) => (lang === "en" ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : d.slice(5).replace("-", "."));

  async function exportCsv() {
    const res = await fetch(`${API_URL}/api/analytics/export.csv?days=${days}`, { headers: { Authorization: `Bearer ${getToken()}` } });
    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = `analytics-${days}d.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const header = (
    <PageHeader
      title={a.title}
      subtitle={a.subtitle}
      actions={
        <>
          <div className="inline-flex rounded-xl border border-line bg-white p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setDays(r)}
                className={cx("rounded-lg px-3 py-1.5 text-sm font-medium", days === r ? "bg-brand-600 text-white" : "text-slate-600 hover:text-ink")}
              >
                {a.range(r)}
              </button>
            ))}
          </div>
          <Button variant="outline" onClick={exportCsv}>
            ⬇ {a.export}
          </Button>
        </>
      }
    />
  );

  if (!data || data.days !== days) {
    return (
      <div>
        {header}
        <div className="flex justify-center py-20 text-brand-600">
          <Spinner />
        </div>
      </div>
    );
  }

  const c = data.current;
  const p = data.previous;
  const labels = data.series.map((s) => s.date);
  const msgSeries = [
    { key: "inbound", label: a.series.inbound, color: S1, values: data.series.map((s) => s.inbound) },
    { key: "bot", label: a.series.bot, color: S2, values: data.series.map((s) => s.bot) },
    { key: "agent", label: a.series.agent, color: S3, values: data.series.map((s) => s.agent) },
  ];
  const growthSeries = [
    { key: "newContacts", label: a.series.newContacts, color: S1, values: data.series.map((s) => s.newContacts) },
    { key: "leads", label: a.series.leads, color: S2, values: data.series.map((s) => s.leads) },
  ];
  const avg = data.responseTime.bot.avgSeconds;

  return (
    <div>
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label={a.kpi.inbound} value={c.inbound.toLocaleString()} current={c.inbound} previous={p.inbound} vsLabel={a.vsPrev} newLabel={a.newLabel} />
        <StatTile label={a.kpi.bot} value={c.bot.toLocaleString()} current={c.bot} previous={p.bot} vsLabel={a.vsPrev} newLabel={a.newLabel} />
        <StatTile label={a.kpi.automation} value={`${c.automationRate}%`} current={c.automationRate} previous={p.automationRate} vsLabel={a.vsPrev} newLabel={a.newLabel} />
        <StatTile label={a.kpi.avgResponse} value={avg === null ? "—" : a.seconds(avg)} vsLabel="" />
        <StatTile label={a.kpi.newContacts} value={c.newContacts.toLocaleString()} current={c.newContacts} previous={p.newContacts} vsLabel={a.vsPrev} newLabel={a.newLabel} />
        <StatTile label={a.kpi.leads} value={c.leads.toLocaleString()} current={c.leads} previous={p.leads} vsLabel={a.vsPrev} newLabel={a.newLabel} />
        <StatTile label={a.kpi.conversion} value={`${c.conversionRate}%`} current={c.conversionRate} previous={p.conversionRate} vsLabel={a.vsPrev} newLabel={a.newLabel} />
        <StatTile label={a.kpi.agent} value={c.agent.toLocaleString()} current={c.agent} previous={p.agent} vsLabel={a.vsPrev} newLabel={a.newLabel} invert />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel
          title={a.messagesChart}
          className="lg:col-span-2"
          right={
            <button onClick={() => setTable(!table)} className="text-xs font-semibold text-brand-700 hover:underline">
              {table ? a.hideTable : a.showTable}
            </button>
          }
        >
          <div className="mb-3">
            <Legend series={msgSeries} />
          </div>
          <LineChart series={msgSeries} labels={labels} formatLabel={shortDate} />
        </Panel>
        <Panel title={a.channels}>
          <BarList
            empty={a.noData}
            items={(["FACEBOOK", "INSTAGRAM", "WEB"] as const).map((pl) => ({
              key: pl,
              label: (
                <span className="flex items-center gap-2">
                  <PlatformIcon platform={pl} className="h-4 w-4" />
                  {a.channelNames[pl]}
                </span>
              ),
              value: data.platforms.messages[pl] ?? 0,
            }))}
          />
        </Panel>
      </div>

      {table && (
        <Card className="mt-6 max-h-96 overflow-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 bg-canvas text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-2">{a.date}</th>
                <th className="px-4 py-2 text-right">{a.series.inbound}</th>
                <th className="px-4 py-2 text-right">{a.series.bot}</th>
                <th className="px-4 py-2 text-right">{a.series.agent}</th>
                <th className="px-4 py-2 text-right">{a.series.newContacts}</th>
                <th className="px-4 py-2 text-right">{a.series.leads}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {[...data.series].reverse().map((s) => (
                <tr key={s.date}>
                  <td className="px-4 py-2">{s.date}</td>
                  <td className="px-4 py-2 text-right">{s.inbound}</td>
                  <td className="px-4 py-2 text-right">{s.bot}</td>
                  <td className="px-4 py-2 text-right">{s.agent}</td>
                  <td className="px-4 py-2 text-right">{s.newContacts}</td>
                  <td className="px-4 py-2 text-right">{s.leads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title={a.growthChart} className="lg:col-span-2">
          <div className="mb-3">
            <Legend series={growthSeries} />
          </div>
          <LineChart series={growthSeries} labels={labels} formatLabel={shortDate} height={200} />
        </Panel>
        <Panel title={a.funnel}>
          <Funnel
            steps={[
              { key: "n", label: a.funnelSteps.newContacts, value: data.funnel.newContacts },
              { key: "e", label: a.funnelSteps.engaged, value: data.funnel.engaged },
              { key: "l", label: a.funnelSteps.withLead, value: data.funnel.withLead },
              { key: "d", label: a.funnelSteps.done, value: data.funnel.done },
            ]}
          />
        </Panel>
      </div>

      <Panel title={a.heatmap} hint={a.heatmapHint} className="mt-6">
        <Heatmap data={data.heatmap} rows={a.weekdays} unit={a.messagesUnit} less={a.less} more={a.more} />
      </Panel>

      <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Panel title={a.responseTime} right={avg !== null && <Badge className="!bg-brand-50 !text-brand-700">⌀ {a.seconds(avg)}</Badge>}>
          <BarList empty={a.noData} color={S1} items={a.buckets.map((b, i) => ({ key: b, label: b, value: data.responseTime.bot.buckets[i] ?? 0 }))} />
        </Panel>
        <Panel title={a.leadTypes}>
          <BarList empty={a.noData} items={(["ORDER", "BOOKING", "INQUIRY"] as const).map((k) => ({ key: k, label: t.dash.leads.types[k], value: data.leads.byType[k] ?? 0 }))} />
          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">{a.leadStatus}</p>
          <BarList empty={a.noData} color={S1} items={(["NEW", "CONTACTED", "DONE", "CANCELED"] as const).map((k) => ({ key: k, label: t.dash.leads.statuses[k], value: data.leads.byStatus[k] ?? 0 }))} />
        </Panel>
        <Panel title={a.tagSources}>
          <BarList empty={a.noData} items={(["MANUAL", "KEYWORD", "AI", "COMMENT"] as const).map((k) => ({ key: k, label: a.sources[k], value: data.tagSources[k] ?? 0 }))} />
        </Panel>
        <Panel title={a.topTags}>
          <BarList
            empty={a.noData}
            items={data.tags.map((tg) => ({ key: tg.id, label: <Badge color={tg.color}>{tg.name}</Badge>, value: tg.count }))}
          />
        </Panel>
        <Panel title={a.topWords}>
          {data.topWords.length ? (
            <div className="flex flex-wrap gap-1.5">
              {data.topWords.map((w, i) => (
                <span
                  key={w.word}
                  className={cx("rounded-full border px-2.5 py-1", i < 5 ? "border-brand-200 bg-brand-50 text-sm font-semibold text-brand-800" : "border-line text-xs text-slate-600")}
                  title={`${w.count}`}
                >
                  {w.word} <span className="text-slate-400">{w.count}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-sm text-muted">{a.noData}</p>
          )}
        </Panel>
        <Panel title={a.usage}>
          <p className="text-3xl font-bold tabular-nums">
            {data.usage.aiReplies.toLocaleString()} <span className="text-base font-normal text-muted">/ {data.usage.limit.toLocaleString()}</span>
          </p>
          <div className="mt-3">
            <Progress value={data.usage.aiReplies} max={data.usage.limit} />
          </div>
        </Panel>
      </div>

      <Panel title={a.broadcasts} className="mt-6">
        {data.broadcasts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2">{a.bcCols.name}</th>
                  <th className="pb-2 text-right">{a.bcCols.sent}</th>
                  <th className="pb-2 text-right">{a.bcCols.failed}</th>
                  <th className="pb-2 text-right">{a.bcCols.skipped}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {data.broadcasts.map((b) => (
                  <tr key={b.id}>
                    <td className="py-2.5">
                      {b.name} <Badge className="ml-1">{t.dash.broadcasts.types[b.type as keyof typeof t.dash.broadcasts.types]}</Badge>
                    </td>
                    <td className="py-2.5 text-right font-semibold">{b.sentCount}</td>
                    <td className="py-2.5 text-right">{b.failedCount}</td>
                    <td className="py-2.5 text-right">{b.skippedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted">{a.noData}</p>
        )}
      </Panel>
    </div>
  );
}
