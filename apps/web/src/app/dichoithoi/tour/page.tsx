"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { affiliatePartnerSchema, tourSchema, type Tour } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { PageHeader } from "@/shared/ui/page-header";
import { AffiliateUrlPreview } from "@/features/dichoithoi/affiliate-url-preview";
import { ImportToursModal } from "@/features/dichoithoi/import-tours-modal";

const EMPTY_FORM = {
  name: "",
  shortDescription: "",
  durationDays: "",
  durationNights: "",
  departureFrom: "",
  provinceCode: "",
  priceFrom: "",
  rating: "",
  reviewCount: "",
  thumbnailUrl: "",
  provider: "",
  sourceUrl: "",
};

/** Man "Tour" (tour-spec §6) — MVP nhap tay, publish thang xuong website */
export default function ToursPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const toursQuery = useQuery({
    queryKey: ["tours"],
    queryFn: () => apiGet("/tours", z.array(tourSchema)),
  });
  const partnersQuery = useQuery({
    queryKey: ["affiliate-partners"],
    queryFn: () => apiGet("/affiliate/partners", z.array(affiliatePartnerSchema)),
  });
  const activePartners = (partnersQuery.data ?? []).filter((p) => p.isActive);

  const save = useMutation({
    mutationFn: async () => {
      const num = (s: string) => (s.trim() === "" ? null : Number(s));
      const body = {
        name: form.name.trim(),
        shortDescription: form.shortDescription.trim() || null,
        durationDays: num(form.durationDays),
        durationNights: num(form.durationNights),
        departureFrom: form.departureFrom.trim() || null,
        provinceCode: form.provinceCode.trim() || null,
        priceFrom: num(form.priceFrom),
        rating: num(form.rating),
        reviewCount: num(form.reviewCount),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        provider: form.provider.trim() || null,
        sourceUrl: form.sourceUrl.trim(),
      };
      if (editingId) {
        return tourSchema.parse(await apiSend("PATCH", `/tours/${editingId}`, body));
      }
      return tourSchema.parse(await apiSend("POST", "/tours", body));
    },
    onSuccess: () => {
      setError(null);
      setForm(EMPTY_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["tours"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  function startEdit(t: Tour) {
    setEditingId(t.id);
    setForm({
      name: t.name,
      shortDescription: t.shortDescription ?? "",
      durationDays: t.durationDays === null ? "" : String(t.durationDays),
      durationNights: t.durationNights === null ? "" : String(t.durationNights),
      departureFrom: t.departureFrom ?? "",
      provinceCode: t.provinceCode ?? "",
      priceFrom: t.priceFrom === null ? "" : String(t.priceFrom),
      rating: t.rating === null ? "" : String(t.rating),
      reviewCount: t.reviewCount === null ? "" : String(t.reviewCount),
      thumbnailUrl: t.thumbnailUrl ?? "",
      provider: t.provider ?? "",
      sourceUrl: t.sourceUrl,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tour"
        description="Khối gợi ý trên trang điểm đến — 1 tour có thể gán nhiều điểm đến, không có trang riêng, không qua duyệt (tour-spec §2). Lưu sẽ publish thẳng lên website."
        actions={
          <Button size="sm" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
            Nhập từ Sheet
          </Button>
        }
      />

      <ImportToursModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["tours"] })}
      />

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">{editingId ? "Sửa tour" : "Thêm tour"}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            className="md:col-span-2"
            placeholder="Tên tour *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Mã tỉnh đích (vd: 22)"
            value={form.provinceCode}
            onChange={(e) => setForm((f) => ({ ...f, provinceCode: e.target.value }))}
          />
          <Input
            className="md:col-span-3"
            placeholder="Mô tả ngắn"
            value={form.shortDescription}
            onChange={(e) => setForm((f) => ({ ...f, shortDescription: e.target.value }))}
          />
          <Input
            placeholder="Số ngày"
            value={form.durationDays}
            onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
          />
          <Input
            placeholder="Số đêm"
            value={form.durationNights}
            onChange={(e) => setForm((f) => ({ ...f, durationNights: e.target.value }))}
          />
          <Input
            placeholder="Điểm khởi hành (vd: Hà Nội)"
            value={form.departureFrom}
            onChange={(e) => setForm((f) => ({ ...f, departureFrom: e.target.value }))}
          />
          <Input
            placeholder="Giá từ (VND)"
            value={form.priceFrom}
            onChange={(e) => setForm((f) => ({ ...f, priceFrom: e.target.value }))}
          />
          <Input
            placeholder="Rating (0-10)"
            value={form.rating}
            onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
          />
          <Input
            placeholder="Số lượt đánh giá"
            value={form.reviewCount}
            onChange={(e) => setForm((f) => ({ ...f, reviewCount: e.target.value }))}
          />
          <Input
            placeholder="Ảnh (thumbnail URL)"
            value={form.thumbnailUrl}
            onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))}
          />
          <Select
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          >
            <option value="">— chọn đối tác * —</option>
            {activePartners.map((p) => (
              <option key={p.id} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
          <Input
            className="md:col-span-3"
            placeholder="Link gốc (sourceUrl) *"
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
          />
        </div>
        <div className="mt-2">
          <AffiliateUrlPreview sourceUrl={form.sourceUrl} provider={form.provider} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.name.trim() || !form.sourceUrl.trim() || !form.provider}
            onClick={() => save.mutate()}
          >
            {editingId ? "Lưu thay đổi" : "Tạo tour"}
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
        {toursQuery.data?.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between rounded border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t.name}</span>
                <Badge
                  tone={
                    t.linkStatus === "converted"
                      ? "emerald"
                      : t.linkStatus === "no-rule"
                        ? "amber"
                        : "gray"
                  }
                >
                  {t.linkStatus}
                </Badge>
                {t.siteId === null && <Badge tone="red">Chưa publish</Badge>}
              </div>
              <div className="text-xs text-zinc-500">
                {t.durationDays ?? "—"}N{t.durationNights ?? "—"}Đ · Khởi hành{" "}
                {t.departureFrom ?? "—"} · Giá từ {t.priceFrom ?? "—"} · {t.destinationCount} điểm
                đến đang gán
              </div>
            </div>
            <Button size="sm" onClick={() => startEdit(t)}>
              Sửa
            </Button>
          </div>
        ))}
        {toursQuery.data?.length === 0 && <p className="text-sm text-zinc-500">Chưa có tour nào.</p>}
      </div>
    </div>
  );
}
