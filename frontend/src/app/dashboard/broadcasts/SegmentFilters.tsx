"use client";

import { Input, Label, PlatformIcon, Select } from "@/components/ui";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { SegmentFilters as Filters } from "@/lib/types";

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

const toggle = <T,>(list: T[] | undefined, v: T) => (list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v]);

/** Audience segment editor: age, gender, location, channel, activity, orders. */
export function SegmentFilters({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const { t } = useI18n();
  const s = t.dash.broadcasts.segment;
  const i = t.dash.inbox;
  const { data: loc } = useApi<{ cities: string[]; districts: string[] }>("/locations");
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const num = (v: string) => (v === "" ? null : Math.max(0, Math.min(120, Number(v))));
  const showDistricts = !value.cities?.length || value.cities.includes("Улаанбаатар");

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-canvas p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted">ⓘ {s.hint}</p>
        <button type="button" onClick={() => onChange({})} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">
          {s.clear}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>{s.age}</Label>
          <div className="flex items-center gap-2">
            <Input type="number" min={0} max={120} className="!h-9" value={value.ageMin ?? ""} placeholder="18" onChange={(e) => set({ ageMin: num(e.target.value) })} />
            <span className="text-xs text-muted">{s.from}</span>
            <Input type="number" min={0} max={120} className="!h-9" value={value.ageMax ?? ""} placeholder="35" onChange={(e) => set({ ageMax: num(e.target.value) })} />
            <span className="text-xs text-muted">{s.to}</span>
          </div>
        </div>
        <div>
          <Label>{s.gender}</Label>
          <div className="flex flex-wrap gap-1.5">
            <Chip on={!value.gender} onClick={() => set({ gender: null })}>
              {s.any}
            </Chip>
            <Chip on={value.gender === "MALE"} onClick={() => set({ gender: "MALE" })}>
              {i.male}
            </Chip>
            <Chip on={value.gender === "FEMALE"} onClick={() => set({ gender: "FEMALE" })}>
              {i.female}
            </Chip>
          </div>
        </div>
      </div>

      <div>
        <Label>{s.city}</Label>
        <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          {(loc?.cities ?? []).map((c) => (
            <Chip key={c} on={!!value.cities?.includes(c)} onClick={() => set({ cities: toggle(value.cities, c) })}>
              {c}
            </Chip>
          ))}
        </div>
      </div>

      {showDistricts && (
        <div>
          <Label>{s.district}</Label>
          <div className="flex flex-wrap gap-1.5">
            {(loc?.districts ?? []).map((d) => (
              <Chip key={d} on={!!value.districts?.includes(d)} onClick={() => set({ districts: toggle(value.districts, d) })}>
                {d}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label>{s.channel}</Label>
          <div className="flex flex-wrap gap-1.5">
            {(["FACEBOOK", "INSTAGRAM"] as const).map((p) => (
              <Chip key={p} on={!!value.platforms?.includes(p)} onClick={() => set({ platforms: toggle(value.platforms, p) })}>
                <span className="flex items-center gap-1">
                  <PlatformIcon platform={p} className="h-3.5 w-3.5" />
                  {t.dash.analytics.channelNames[p]}
                </span>
              </Chip>
            ))}
          </div>
        </div>
        <label className="block">
          <Label>{s.activity}</Label>
          <Select className="!h-9" value={value.activeWithinDays ?? ""} onChange={(e) => set({ activeWithinDays: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{s.anyTime}</option>
            {[1, 7, 30, 90].map((d) => (
              <option key={d} value={d}>
                {s.withinDays(d)}
              </option>
            ))}
          </Select>
        </label>
        <label className="block">
          <Label>{s.leads}</Label>
          <Select
            className="!h-9"
            value={value.hasLead == null ? "" : value.hasLead ? "yes" : "no"}
            onChange={(e) => set({ hasLead: e.target.value === "" ? null : e.target.value === "yes" })}
          >
            <option value="">{s.any}</option>
            <option value="yes">{s.hasLead}</option>
            <option value="no">{s.noLead}</option>
          </Select>
        </label>
      </div>
    </div>
  );
}

/** Short human-readable summary of a segment (for the broadcast list). */
export function segmentSummary(f: Filters | undefined, t: ReturnType<typeof useI18n>["t"]): string[] {
  if (!f) return [];
  const s = t.dash.broadcasts.segment;
  const out: string[] = [];
  if (f.ageMin != null || f.ageMax != null) out.push(s.summaryAge(f.ageMin, f.ageMax));
  if (f.gender) out.push(f.gender === "MALE" ? t.dash.inbox.male : t.dash.inbox.female);
  if (f.cities?.length) out.push(f.cities.join(", "));
  if (f.districts?.length) out.push(f.districts.join(", "));
  if (f.platforms?.length) out.push(f.platforms.map((p) => t.dash.analytics.channelNames[p]).join(", "));
  if (f.activeWithinDays) out.push(s.withinDays(f.activeWithinDays));
  if (f.hasLead != null) out.push(f.hasLead ? s.hasLead : s.noLead);
  return out;
}
