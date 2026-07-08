"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import {
  affiliateLinkRuleSchema,
  affiliatePlaceholderSchema,
  reapplyAffiliateRuleReportSchema,
  type AffiliateLinkRule,
  type AffiliatePlaceholder,
} from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";

const EMPTY_FORM = {
  provider: "",
  matchDomain: "",
  template: "",
  placeholder: "{url_enc}" as AffiliatePlaceholder,
  isActive: true,
  notes: "",
};

/** Man "Quy tắc affiliate" (affiliate-link-conversion-spec §5) — CRUD rule + áp dụng lại */
export default function AffiliateRulesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reapplyMsg, setReapplyMsg] = useState<string | null>(null);

  const rulesQuery = useQuery({
    queryKey: ["affiliate-rules"],
    queryFn: () => apiGet("/affiliate/rules", z.array(affiliateLinkRuleSchema)),
  });

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        provider: form.provider.trim(),
        matchDomain: form.matchDomain.trim() || null,
        template: form.template.trim(),
        placeholder: form.placeholder,
        isActive: form.isActive,
        notes: form.notes.trim() || null,
      };
      if (editingId) {
        return affiliateLinkRuleSchema.parse(
          await apiSend("PATCH", `/affiliate/rules/${editingId}`, body),
        );
      }
      return affiliateLinkRuleSchema.parse(await apiSend("POST", "/affiliate/rules", body));
    },
    onSuccess: () => {
      setError(null);
      setForm(EMPTY_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["affiliate-rules"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const reapply = useMutation({
    mutationFn: async (ruleId: string | null) =>
      reapplyAffiliateRuleReportSchema.parse(
        await apiSend("POST", "/affiliate/reapply", { ruleId }),
      ),
    onSuccess: (r) => {
      setReapplyMsg(
        `Đã cập nhật ${r.totalUpdated} link (${r.targets
          .map((t) => `${t.label}: ${t.updatedCount}`)
          .join(", ")}) trong ${r.durationMs}ms`,
      );
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  function startEdit(rule: AffiliateLinkRule) {
    setEditingId(rule.id);
    setForm({
      provider: rule.provider,
      matchDomain: rule.matchDomain ?? "",
      template: rule.template,
      placeholder: rule.placeholder,
      isActive: rule.isActive,
      notes: rule.notes ?? "",
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Quy tắc affiliate</h2>
        <p className="text-sm text-zinc-500">
          Chuyển đổi link gốc → link affiliate cho vé điểm đến / khách sạn / tour. Sửa rule
          không cần deploy — bấm &quot;Áp dụng lại&quot; để cập nhật link cũ.
        </p>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}
      {reapplyMsg && (
        <div className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          {reapplyMsg}
        </div>
      )}

      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">{editingId ? "Sửa rule" : "Thêm rule mới"}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            placeholder="provider (vd: klook)"
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          />
          <Input
            placeholder="match_domain (vd: klook.com)"
            value={form.matchDomain}
            onChange={(e) => setForm((f) => ({ ...f, matchDomain: e.target.value }))}
          />
          <Input
            className="md:col-span-2"
            placeholder="template (vd: https://www.klook.com/aff/123/?url={url_enc})"
            value={form.template}
            onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))}
          />
          <Select
            value={form.placeholder}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                placeholder: affiliatePlaceholderSchema.parse(e.target.value),
              }))
            }
          >
            <option value="{url_enc}">{"{url_enc}"} — URL-encode</option>
            <option value="{url}">{"{url}"} — giữ nguyên</option>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            />
            Đang bật
          </label>
          <Input
            className="md:col-span-2"
            placeholder="Ghi chú (tuỳ chọn)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.provider.trim() || !form.template.trim()}
            onClick={() => save.mutate()}
          >
            {editingId ? "Lưu rule" : "Thêm rule"}
          </Button>
          {editingId && (
            <Button
              variant="ghost"
              onClick={() => {
                setEditingId(null);
                setForm(EMPTY_FORM);
              }}
            >
              Huỷ sửa
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {rulesQuery.data?.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between rounded border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{rule.provider}</span>
                <Badge tone={rule.isActive ? "emerald" : "gray"}>
                  {rule.isActive ? "Đang bật" : "Đã tắt"}
                </Badge>
              </div>
              <div className="text-xs text-zinc-500">
                {rule.matchDomain ?? "(không tự nhận diện domain)"} · {rule.template}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => startEdit(rule)}>
                Sửa
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={reapply.isPending}
                onClick={() => reapply.mutate(rule.id)}
              >
                Áp dụng lại
              </Button>
            </div>
          </div>
        ))}
        {rulesQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có rule nào.</p>
        )}
      </div>

      <Button
        variant="secondary"
        loading={reapply.isPending}
        onClick={() => reapply.mutate(null)}
      >
        Áp dụng lại TOÀN BỘ rule
      </Button>
    </div>
  );
}
