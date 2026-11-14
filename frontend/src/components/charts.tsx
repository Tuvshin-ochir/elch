"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/format";

/**
 * Small chart kit (hand-built SVG/HTML).
 * Color roles come from globals.css: --color-series-1..3 (validated categorical order)
 * and --color-seq-100..700 (one-hue sequential ramp). Text never wears series colors.
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const nf = new Intl.NumberFormat("en-US");

export interface Series {
  key: string;
  label: string;
  color: string;
  values: number[];
}

export function Legend({ series }: { series: Array<{ key: string; label: string; color: string }> }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

/** Multi-series line chart with crosshair + tooltip. */
export function LineChart({ series, labels, height = 220, formatLabel }: { series: Series[]; labels: string[]; height?: number; formatLabel?: (l: string) => string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 34, r: 10, t: 10, b: 24 };
  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const niceMax = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    return Math.ceil(max / p) * p;
  })();
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => pad.t + ih - (v / niceMax) * ih;
  const ticks = [0, niceMax / 2, niceMax];
  const fmt = formatLabel ?? ((l: string) => l);

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / Math.max(1, rect.width);
    setHover(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  }

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} className="overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="#e7ece9" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" className="fill-slate-400 text-[10px]">
                {nf.format(Math.round(t))}
              </text>
            </g>
          ))}
          {[0, Math.floor((n - 1) / 2), n - 1]
            .filter((v, i, a) => n > 0 && a.indexOf(v) === i)
            .map((i) => (
              <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-slate-400 text-[10px]">
                {fmt(labels[i])}
              </text>
            ))}
          {series.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
            />
          ))}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="#94a3b8" strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.key} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />
              ))}
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-36 rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hover) + 12, 0), width - 160), top: 4 }}
        >
          <p className="mb-1 font-semibold text-ink">{fmt(labels[hover])}</p>
          {series.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-4 text-slate-600">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.label}
              </span>
              <span className="font-semibold text-ink">{nf.format(s.values[hover] ?? 0)}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Horizontal bars, one hue; label left, value right. */
export function BarList({ items, color = "var(--color-brand-500)", empty, valueFormat }: { items: Array<{ key: string; label: ReactNode; value: number; hint?: string }>; color?: string; empty?: string; valueFormat?: (v: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((a, b) => a + b.value, 0);
  if (!items.length || total === 0) return <p className="py-6 text-center text-sm text-muted">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.key} title={it.hint ?? `${nf.format(it.value)} (${Math.round((it.value / total) * 100)}%)`} className="group">
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-slate-700">{it.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{valueFormat ? valueFormat(it.value) : nf.format(it.value)}</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full transition-all group-hover:opacity-80" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, backgroundColor: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const SEQ = ["var(--color-seq-100)", "var(--color-seq-200)", "var(--color-seq-300)", "var(--color-seq-400)", "var(--color-seq-500)", "var(--color-seq-600)", "var(--color-seq-700)"];

/** 7×24 heatmap on the sequential ramp. */
export function Heatmap({ data, rows, unit, less, more }: { data: number[][]; rows: string[]; unit: string; less: string; more: string }) {
  const max = Math.max(0, ...data.flat());
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const step = (v: number) => (v === 0 || max === 0 ? -1 : Math.min(SEQ.length - 1, Math.floor((v / max) * (SEQ.length - 1) + 0.0001)));
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-[34px_repeat(24,minmax(0,1fr))] gap-[2px]">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center text-[10px] text-slate-400">
                {h % 3 === 0 ? h : ""}
              </span>
            ))}
            {data.map((row, r) => (
              <div key={r} className="contents">
                <span className="pr-1 text-right text-[11px] leading-5 text-slate-500">{rows[r]}</span>
                {row.map((v, c) => {
                  const s = step(v);
                  return (
                    <div
                      key={c}
                      onMouseEnter={() => setHover({ r, c })}
                      onMouseLeave={() => setHover(null)}
                      className={cx("h-5 rounded-[3px]", hover?.r === r && hover?.c === c && "ring-2 ring-ink")}
                      style={{ backgroundColor: s < 0 ? "#f1f5f3" : SEQ[s] }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span className="min-h-4">
          {hover && (
            <>
              <b className="text-ink">
                {rows[hover.r]} {String(hover.c).padStart(2, "0")}:00
              </b>{" "}
              — {nf.format(data[hover.r][hover.c])} {unit}
            </>
          )}
        </span>
        <span className="flex items-center gap-1">
          {less}
          {SEQ.map((c) => (
            <span key={c} className="h-3 w-4 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          {more}
        </span>
      </div>
    </div>
  );
}

/** Ordered funnel — bar width relative to the first step, % of first shown. */
export function Funnel({ steps }: { steps: Array<{ key: string; label: string; value: number }> }) {
  const first = Math.max(1, steps[0]?.value ?? 1);
  const ramp = ["var(--color-seq-300)", "var(--color-seq-400)", "var(--color-seq-500)", "var(--color-seq-600)"];
  return (
    <ul className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.key}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-700">{s.label}</span>
            <span className="font-semibold tabular-nums">
              {nf.format(s.value)} <span className="font-normal text-slate-400">· {Math.round((s.value / first) * 100)}%</span>
            </span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100">
            <div className="h-3 rounded-full" style={{ width: `${Math.max(2, (s.value / first) * 100)}%`, backgroundColor: ramp[Math.min(i, ramp.length - 1)] }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** KPI tile with change vs. previous period (arrow + sign, never color alone). */
export function StatTile({ label, value, current, previous, vsLabel, newLabel = "new", invert }: { label: string; value: ReactNode; current?: number; previous?: number; vsLabel: string; newLabel?: string; invert?: boolean }) {
  let delta: ReactNode = null;
  if (current !== undefined && previous !== undefined) {
    if (previous === 0) delta = current > 0 ? <span className="text-slate-500">▲ {newLabel}</span> : <span className="text-slate-400">—</span>;
    else {
      const pct = Math.round(((current - previous) / previous) * 100);
      const good = invert ? pct <= 0 : pct >= 0;
      delta = (
        <span className={good ? "text-brand-700" : "text-red-600"}>
          {pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%
        </span>
      );
    }
  }
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-sm">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      {delta && (
        <p className="mt-1 text-xs font-medium">
          {delta} <span className="font-normal text-slate-400">{vsLabel}</span>
        </p>
      )}
    </div>
  );
}
