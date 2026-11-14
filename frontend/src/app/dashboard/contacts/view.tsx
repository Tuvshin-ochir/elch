"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Badge, Button, Card, EmptyState, Input, PageHeader, Select, Spinner } from "@/components/ui";
import { post } from "@/lib/api";
import { cx, timeAgo } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { Contact, Tag } from "@/lib/types";

export default function ContactsPage() {
  const { t, lang } = useI18n();
  const c = t.dash.contacts;
  const [search, setSearch] = useState("");
  const [tagId, setTagId] = useState("");
  const [platform, setPlatform] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const { data: loc } = useApi<{ cities: string[]; districts: string[] }>("/locations");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTag, setBulkTag] = useState("");
  const { data: tags, reload: reloadTags } = useApi<Tag[]>("/tags");

  const q = new URLSearchParams({ take: "200" });
  if (search) q.set("search", search);
  if (tagId) q.set("tagId", tagId);
  if (platform) q.set("platform", platform);
  if (ageMin) q.set("ageMin", ageMin);
  if (ageMax) q.set("ageMax", ageMax);
  if (city) q.set("city", city);
  if (district) q.set("district", district);
  const { data, reload } = useApi<{ items: Contact[]; total: number }>(`/contacts?${q}`);

  const allSelected = !!data?.items.length && data.items.every((x) => selected.has(x.id));
  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };

  async function applyBulk() {
    if (!bulkTag || !selected.size) return;
    await post("/contacts/bulk-tag", { contactIds: [...selected], tagId: bulkTag });
    setSelected(new Set());
    setBulkTag("");
    reload();
    reloadTags();
  }

  return (
    <div>
      <PageHeader title={c.title} subtitle={c.subtitle} />
      <Card>
        <div className="flex flex-col flex-wrap gap-2 border-b border-line p-4 md:flex-row md:items-center">
          <Input className="md:max-w-xs" placeholder={`🔎 ${t.common.search}`} value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select className="md:max-w-[180px]" value={tagId} onChange={(e) => setTagId(e.target.value)}>
            <option value="">{t.common.all} tags</option>
            {tags?.map((tg) => (
              <option key={tg.id} value={tg.id}>
                {tg.name} ({tg.contactCount})
              </option>
            ))}
          </Select>
          <Select className="md:max-w-[160px]" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">{t.common.all}</option>
            <option value="FACEBOOK">Messenger</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="WEB">{t.dash.analytics.channelNames.WEB}</option>
          </Select>
          <div className="flex items-center gap-1.5">
            <Input type="number" className="!h-10 w-24" placeholder={c.ageFrom} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} />
            <span className="text-muted">–</span>
            <Input type="number" className="!h-10 w-20" placeholder={c.ageTo} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} />
          </div>
          <Select className="md:max-w-[170px]" value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{c.allCities}</option>
            {loc?.cities.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <Select className="md:max-w-[170px]" value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="">{c.allDistricts}</option>
            {loc?.districts.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 md:ml-auto">
              <span className="whitespace-nowrap text-sm text-muted">{c.selected(selected.size)}</span>
              <Select className="!h-9 md:max-w-[160px]" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)}>
                <option value="">Tag…</option>
                {tags?.map((tg) => (
                  <option key={tg.id} value={tg.id}>
                    {tg.name}
                  </option>
                ))}
              </Select>
              <Button size="sm" onClick={applyBulk} disabled={!bulkTag}>
                {c.bulkTag}
              </Button>
            </div>
          )}
        </div>
        {!data ? (
          <div className="flex justify-center py-12 text-brand-600">
            <Spinner />
          </div>
        ) : data.items.length === 0 ? (
          <EmptyState icon="👥" title={c.empty} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-muted">
                <tr>
                  <th className="w-10 px-4 py-2.5">
                    <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(data.items.map((x) => x.id)))} />
                  </th>
                  <th className="px-2 py-2.5 font-medium">{t.common.name}</th>
                  <th className="px-2 py-2.5 font-medium">{t.common.phone}</th>
                  <th className="px-2 py-2.5 font-medium">{c.age}</th>
                  <th className="px-2 py-2.5 font-medium">{c.location}</th>
                  <th className="px-2 py-2.5 font-medium">{c.tags}</th>
                  <th className="px-2 py-2.5 font-medium">{c.lastMessage}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.items.map((x) => (
                  <tr key={x.id} className={cx(selected.has(x.id) && "bg-brand-50/50")}>
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(x.id)} onChange={() => toggle(x.id)} />
                    </td>
                    <td className="px-2 py-3">
                      <Link href={`/dashboard/inbox?contact=${x.id}`} className="flex items-center gap-2.5 font-medium hover:text-brand-600">
                        <Avatar src={x.profilePic} name={x.name} platform={x.platform} size={32} />
                        {x.name ?? x.username ?? "—"}
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-muted">{x.phone ?? "—"}</td>
                    <td className="px-2 py-3 text-muted">{x.birthYear ? new Date().getFullYear() - x.birthYear : "—"}</td>
                    <td className="px-2 py-3 text-muted">{[x.city, x.district].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-1">
                        {x.tags.map((tg) => (
                          <Badge key={tg.id} color={tg.color}>
                            {tg.name}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="max-w-[260px] px-2 py-3">
                      <p className="truncate text-muted">{x.lastMessageText}</p>
                      <p className="text-xs text-slate-400">{timeAgo(x.lastMessageAt, lang)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
