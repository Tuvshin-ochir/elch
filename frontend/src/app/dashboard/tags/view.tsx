"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card, Input, Label, Modal, PageHeader, Select, Spinner, Textarea, Toggle } from "@/components/ui";
import { ApiError, del, patch, post } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cx } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { Tag, TagRule } from "@/lib/types";

const COLORS = ["#4f46e5", "#2563eb", "#0891b2", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#db2777", "#9333ea", "#475569"];

export default function TagsPage() {
  const { t } = useI18n();
  const g = t.dash.tags;
  const { me } = useAuth();
  const { data: tags, reload: reloadTags } = useApi<Tag[]>("/tags");
  const { data: rules, reload: reloadRules } = useApi<TagRule[]>("/tag-rules");
  const [newTag, setNewTag] = useState({ name: "", color: COLORS[0] });
  const [ruleOpen, setRuleOpen] = useState(false);
  const [rule, setRule] = useState<{ type: TagRule["type"]; tagId: string; keywords: string; intent: string; postId: string }>({
    type: "KEYWORD",
    tagId: "",
    keywords: "",
    intent: "",
    postId: "",
  });
  const [err, setErr] = useState("");
  const aiAllowed = me?.subscription.planDef.features.aiTagging;

  async function createTag() {
    if (!newTag.name.trim()) return;
    setErr("");
    try {
      await post("/tags", newTag);
      setNewTag({ name: "", color: COLORS[(COLORS.indexOf(newTag.color) + 1) % COLORS.length] });
      reloadTags();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    }
  }

  async function createRule() {
    setErr("");
    try {
      await post("/tag-rules", {
        type: rule.type,
        tagId: rule.tagId,
        keywords: rule.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        intent: rule.intent || null,
        postId: rule.postId || null,
      });
      setRuleOpen(false);
      setRule({ type: "KEYWORD", tagId: "", keywords: "", intent: "", postId: "" });
      reloadRules();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : t.common.error);
    }
  }

  const ruleIcon = { KEYWORD: "🔑", AI_INTENT: "🤖", COMMENT: "💬" };

  return (
    <div>
      <PageHeader title={g.title} subtitle={g.subtitle} />
      {err && (
        <Alert tone="error" className="mb-5">
          {err}
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">{g.tags}</h2>
          <div className="mb-4 flex gap-2">
            <Input placeholder={g.newTag} value={newTag.name} onChange={(e) => setNewTag({ ...newTag, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && createTag()} />
            <Button onClick={createTag}>{t.common.add}</Button>
          </div>
          <div className="mb-5 flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewTag({ ...newTag, color: c })}
                className={cx("h-6 w-6 rounded-full ring-offset-2 transition", newTag.color === c && "ring-2 ring-slate-400")}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
          {!tags ? (
            <Spinner />
          ) : (
            <ul className="divide-y divide-line">
              {tags.map((tg) => (
                <li key={tg.id} className="flex items-center justify-between py-2.5">
                  <Badge color={tg.color}>{tg.name}</Badge>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted">{g.contacts(tg.contactCount ?? 0)}</span>
                    <button
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      onClick={() => confirm(t.common.confirmDelete) && del(`/tags/${tg.id}`).then(() => Promise.all([reloadTags(), reloadRules()]))}
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-muted">✋ {g.manualNote}</p>
        </Card>

        <Card className="p-5 lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">{g.rules}</h2>
            <Button size="sm" onClick={() => setRuleOpen(true)}>
              + {g.newRule}
            </Button>
          </div>
          {!rules ? (
            <Spinner />
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className={cx("flex items-start gap-3 rounded-xl border border-line p-3", !r.active && "opacity-50")}>
                  <span className="text-xl">{ruleIcon[r.type]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase text-muted">{g.ruleTypes[r.type]}</span>
                      <span className="text-slate-300">→</span>
                      <Badge color={r.tag.color}>{r.tag.name}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      {r.type === "AI_INTENT" ? r.intent : r.keywords.length ? r.keywords.join(", ") : "*"}
                      {r.postId && <span className="ml-1 text-xs text-muted">(post {r.postId})</span>}
                    </p>
                  </div>
                  <Toggle checked={r.active} onChange={(v) => patch(`/tag-rules/${r.id}`, { active: v }).then(reloadRules)} />
                  <button className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => del(`/tag-rules/${r.id}`).then(reloadRules)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal open={ruleOpen} onClose={() => setRuleOpen(false)} title={g.newRule}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["KEYWORD", "AI_INTENT", "COMMENT"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setRule({ ...rule, type })}
                className={cx(
                  "rounded-xl border p-3 text-center text-sm font-medium transition",
                  rule.type === type ? "border-brand-500 bg-brand-50 text-brand-700" : "border-line hover:border-brand-300",
                )}
              >
                <div className="text-xl">{ruleIcon[type]}</div>
                {g.ruleTypes[type]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">{g.ruleHints[rule.type]}</p>
          {rule.type === "AI_INTENT" && !aiAllowed && <Alert tone="warn">{t.pricing.f.aiTagging}: {t.dash.channels.planNote}</Alert>}
          <label className="block">
            <Label>{g.tag}</Label>
            <Select value={rule.tagId} onChange={(e) => setRule({ ...rule, tagId: e.target.value })}>
              <option value="">—</option>
              {tags?.map((tg) => (
                <option key={tg.id} value={tg.id}>
                  {tg.name}
                </option>
              ))}
            </Select>
          </label>
          {rule.type === "AI_INTENT" ? (
            <label className="block">
              <Label>{g.intent}</Label>
              <Textarea value={rule.intent} placeholder={g.intentPh} onChange={(e) => setRule({ ...rule, intent: e.target.value })} />
            </label>
          ) : (
            <label className="block">
              <Label>{g.keywords}</Label>
              <Input value={rule.keywords} placeholder="үнэ, хэд вэ, une" onChange={(e) => setRule({ ...rule, keywords: e.target.value })} />
            </label>
          )}
          {rule.type === "COMMENT" && (
            <label className="block">
              <Label>{g.postId}</Label>
              <Input value={rule.postId} onChange={(e) => setRule({ ...rule, postId: e.target.value })} />
            </label>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setRuleOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button onClick={createRule} disabled={!rule.tagId}>
              {t.common.create}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
