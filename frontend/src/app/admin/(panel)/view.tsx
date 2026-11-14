"use client";

import Link from "next/link";
import { BarList, Legend, LineChart, StatTile } from "@/components/charts";
import { BizLink, Panel, shortDay } from "@/components/admin/parts";
import { Alert, PageHeader, Spinner } from "@/components/ui";
import { METHOD_LABEL, PLAN_LABEL, STATUS_LABEL, useAdminApi } from "@/lib/adminApi";
import { cx, date, dateTime, money, timeAgo } from "@/lib/format";

interface Overview {
  kpis: {
    businessesTotal: number;
    new7: number;
    new30: number;
    paying: number;
    suspended: number;
    mrr: number;
    arpu: number;
    revenueMonth: number;
    paymentsMonth: number;
    revenueLastMonth: number;
    revenueTotal: number;
    botRepliesMonth: number;
    conversion: number;
  };
  byPlan: Record<string, number>;
  byStatus: Record<string, number>;
  channels: Record<string, number>;
  series: Array<{ day: string; signups: number; revenue: number; inbound: number; bot: number }>;
  expiring: Array<{ businessId: string; name: string; owner: string; phone: string | null; plan: string; endsAt: string }>;
  recentSignups: Array<{ id: string; name: string; businessType: string; createdAt: string; subscription: { plan: string; status: string } | null; owner: { name: string } }>;
  recentPayments: Array<{ id: string; amount: number; plan: string; method: string; paidAt: string; isAutoCharge: boolean; business: { id: string; name: string } }>;
  system: { facebook: boolean; instagram: boolean; httpsPublicUrl: boolean; publicApiUrl: string; ai: boolean; aiModel: string; qpay: string; card: string };
}

const S1 = "var(--color-series-1)";
const S2 = "var(--color-series-2)";
const S3 = "var(--color-series-3)";
const nf = new Intl.NumberFormat("en-US");

function daysLeft(end: string) {
  const d = Math.ceil((new Date(end).getTime() - Date.now()) / 86_400_000);
  return d <= 1 ? "24 цагийн дотор" : `${d} хоног үлдсэн`;
}

export default function AdminOverview() {
  const { data, error } = useAdminApi<Overview>("/overview");

  if (error) return <Alert tone="error">{error}</Alert>;
  if (!data) {
    return (
      <div className="flex justify-center py-24 text-brand-600">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  const k = data.kpis;
  const labels = data.series.map((d) => d.day);
  const sys = data.system;
  const checks = [
    { ok: sys.facebook, label: "Facebook апп", hint: sys.facebook ? "META_APP_ID тохируулсан" : "META_APP_ID / SECRET хоосон — FB холболт ажиллахгүй" },
    { ok: sys.instagram, label: "Instagram апп", hint: sys.instagram ? "IG_APP_ID тохируулсан" : "IG_APP_ID / SECRET хоосон — IG Login ажиллахгүй" },
    { ok: sys.httpsPublicUrl, label: "Нийтийн https хаяг", hint: sys.httpsPublicUrl ? sys.publicApiUrl : `${sys.publicApiUrl} — webhook, IG Login-д https хэрэгтэй` },
    { ok: sys.ai, label: "Claude AI", hint: sys.ai ? sys.aiModel : "ANTHROPIC_API_KEY хоосон" },
    { ok: sys.qpay === "live", label: "QPay", hint: sys.qpay === "live" ? "Жинхэнэ горим" : "Туршилтын (mock) горим", warn: true },
    { ok: sys.card !== "mock", label: "Картын төлбөр", hint: sys.card === "mock" ? "Туршилтын банк (mock)" : sys.card, warn: true },
  ];

  return (
    <>
      <PageHeader title="Тойм" subtitle="Элч платформын өнөөдрийн байдал" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Сарын тогтмол орлого (MRR)" value={money(k.mrr)} vsLabel="" />
        <StatTile label="Энэ сарын орлого" value={money(k.revenueMonth)} current={k.revenueMonth} previous={k.revenueLastMonth} vsLabel="өмнөх сараас" newLabel="шинэ" />
        <StatTile label="Төлбөртэй харилцагч" value={`${k.paying} / ${k.businessesTotal}`} vsLabel="" />
        <StatTile label="Шинэ бүртгэл (30 хоног)" value={k.new30} vsLabel="" />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
          <p className="text-xs text-muted">Бүртгэлээс төлбөр рүү</p>
          <p className="font-semibold tabular-nums">{Math.round(k.conversion * 100)}%</p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
          <p className="text-xs text-muted">Нэг харилцагчийн дундаж (ARPU)</p>
          <p className="font-semibold tabular-nums">{money(k.arpu)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
          <p className="text-xs text-muted">AI хариулт энэ сард</p>
          <p className="font-semibold tabular-nums">{nf.format(k.botRepliesMonth)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
          <p className="text-xs text-muted">Нийт орлого</p>
          <p className="font-semibold tabular-nums">{money(k.revenueTotal)}</p>
        </div>
      </div>

      {data.expiring.length > 0 && (
        <Panel title="⏳ Хугацаа нь 7 хоногт дуусах" hint="Автомат сунгалтгүй — холбогдож сануулбал зохино" className="mt-6">
          <div className="divide-y divide-line">
            {data.expiring.map((e) => (
              <div key={e.businessId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <BizLink id={e.businessId}>{e.name}</BizLink>
                  <span className="ml-2 text-muted">
                    {e.owner}
                    {e.phone ? ` · ${e.phone}` : ""}
                  </span>
                </div>
                <span className="text-muted">
                  {PLAN_LABEL[e.plan]} · <b className="text-ink">{date(e.endsAt)}</b> ({daysLeft(e.endsAt)})
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Орлого" hint="Сүүлийн 30 хоног, төлөгдсөн төлбөрөөр">
          <Legend series={[{ key: "rev", label: "Орлого (₮)", color: S3 }]} />
          <div className="mt-3">
            <LineChart series={[{ key: "rev", label: "Орлого", color: S3, values: data.series.map((d) => d.revenue) }]} labels={labels} formatLabel={shortDay} height={200} />
          </div>
        </Panel>
        <Panel title="Мессеж" hint="Бүх бизнесийн нийт, сүүлийн 30 хоног">
          <Legend
            series={[
              { key: "in", label: "Хэрэглэгчээс", color: S1 },
              { key: "bot", label: "AI хариулт", color: S2 },
            ]}
          />
          <div className="mt-3">
            <LineChart
              series={[
                { key: "in", label: "Хэрэглэгчээс", color: S1, values: data.series.map((d) => d.inbound) },
                { key: "bot", label: "AI хариулт", color: S2, values: data.series.map((d) => d.bot) },
              ]}
              labels={labels}
              formatLabel={shortDay}
              height={200}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Шинэ бүртгэл" hint="Өдөр бүрээр, 30 хоног">
          <LineChart series={[{ key: "su", label: "Бүртгэл", color: S1, values: data.series.map((d) => d.signups) }]} labels={labels} formatLabel={shortDay} height={150} />
        </Panel>
        <Panel title="Идэвхтэй багцууд">
          <BarList items={(["STARTER", "BUSINESS", "PRO"] as const).map((p) => ({ key: p, label: PLAN_LABEL[p], value: data.byPlan[p] ?? 0 }))} empty="Одоогоор алга" />
        </Panel>
        <Panel title="Захиалгын төлөв">
          <BarList
            color={S1}
            items={["ACTIVE", "PAST_DUE", "INCOMPLETE", "EXPIRED", "CANCELED"].map((s) => ({ key: s, label: STATUS_LABEL[s], value: data.byStatus[s] ?? 0 }))}
            empty="Одоогоор алга"
          />
          {k.suspended > 0 && <p className="mt-3 text-xs text-muted">Түр хаасан: {k.suspended}</p>}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Сүүлийн бүртгэлүүд" right={<Link href="/admin/businesses" className="text-sm font-medium text-brand-700 hover:underline">Бүгдийг харах →</Link>}>
          <div className="divide-y divide-line">
            {data.recentSignups.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <BizLink id={b.id}>{b.name}</BizLink>
                  <p className="truncate text-xs text-muted">{b.owner.name}</p>
                </div>
                <div className="shrink-0 text-right text-xs text-muted">
                  <p>{b.subscription ? `${PLAN_LABEL[b.subscription.plan]} · ${STATUS_LABEL[b.subscription.status]}` : "—"}</p>
                  <p>{timeAgo(b.createdAt)}</p>
                </div>
              </div>
            ))}
            {data.recentSignups.length === 0 && <p className="py-6 text-center text-sm text-muted">Бүртгэл алга</p>}
          </div>
        </Panel>
        <Panel title="Сүүлийн төлбөрүүд" right={<Link href="/admin/payments" className="text-sm font-medium text-brand-700 hover:underline">Бүгдийг харах →</Link>}>
          <div className="divide-y divide-line">
            {data.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <BizLink id={p.business.id}>{p.business.name}</BizLink>
                  <p className="text-xs text-muted">
                    {PLAN_LABEL[p.plan]} · {METHOD_LABEL[p.method]}
                    {p.isAutoCharge ? " · автомат" : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums">{money(p.amount)}</p>
                  <p className="text-xs text-muted">{dateTime(p.paidAt)}</p>
                </div>
              </div>
            ))}
            {data.recentPayments.length === 0 && <p className="py-6 text-center text-sm text-muted">Төлбөр алга</p>}
          </div>
        </Panel>
      </div>

      <Panel title="Системийн төлөв" hint="Платформ ажиллахад шаардлагатай тохиргоонууд" className="mt-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((c) => (
            <div key={c.label} className="flex items-start gap-2.5 rounded-xl bg-canvas px-3 py-2.5">
              <span
                className={cx(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
                  c.ok ? "bg-brand-600" : c.warn ? "bg-amber-500" : "bg-red-500",
                )}
                aria-label={c.ok ? "OK" : "Анхаар"}
              >
                {c.ok ? "✓" : "!"}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className="break-words text-xs text-muted">{c.hint}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Холболтууд: Facebook пэйж {data.channels.FACEBOOK_LOGIN ?? 0} · Пэйжгүй Instagram {(data.channels.INSTAGRAM_LOGIN ?? 0) + (data.channels.INSTAGRAM_UNIFIED ?? 0)}
        </p>
      </Panel>
    </>
  );
}
