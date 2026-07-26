"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { affiliatePartnerSchema, hotelSchema, type Hotel } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select } from "@/shared/ui/select";
import { Badge } from "@/shared/ui/badge";
import { PageHeader } from "@/shared/ui/page-header";
import { FeatureIntro } from "@/shared/ui";
import { AffiliateUrlPreview } from "@/features/dichoithoi/affiliate-url-preview";
import { ImportHotelsModal } from "@/features/dichoithoi/import-hotels-modal";

const EMPTY_FORM = {
  name: "",
  address: "",
  lat: "",
  lng: "",
  provinceCode: "",
  priceFrom: "",
  rating: "",
  reviewCount: "",
  thumbnailUrl: "",
  provider: "",
  sourceUrl: "",
};

/** Man "Khách sạn" (hotel-spec §6) — MVP nhap tay, publish thang xuong website */
export default function HotelsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const hotelsQuery = useQuery({
    queryKey: ["hotels"],
    queryFn: () => apiGet("/hotels", z.array(hotelSchema)),
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
        address: form.address.trim() || null,
        lat: num(form.lat),
        lng: num(form.lng),
        provinceCode: form.provinceCode.trim() || null,
        priceFrom: num(form.priceFrom),
        rating: num(form.rating),
        reviewCount: num(form.reviewCount),
        thumbnailUrl: form.thumbnailUrl.trim() || null,
        provider: form.provider.trim() || null,
        sourceUrl: form.sourceUrl.trim(),
      };
      if (editingId) {
        return hotelSchema.parse(await apiSend("PATCH", `/hotels/${editingId}`, body));
      }
      return hotelSchema.parse(await apiSend("POST", "/hotels", body));
    },
    onSuccess: () => {
      setError(null);
      setForm(EMPTY_FORM);
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  const autoAssign = useMutation({
    mutationFn: () => apiSend("POST", "/hotels/auto-assign", {}),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["hotels"] });
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : String(e)),
  });

  function startEdit(h: Hotel) {
    setEditingId(h.id);
    setForm({
      name: h.name,
      address: h.address ?? "",
      lat: h.lat === null ? "" : String(h.lat),
      lng: h.lng === null ? "" : String(h.lng),
      provinceCode: h.provinceCode ?? "",
      priceFrom: h.priceFrom === null ? "" : String(h.priceFrom),
      rating: h.rating === null ? "" : String(h.rating),
      reviewCount: h.reviewCount === null ? "" : String(h.reviewCount),
      thumbnailUrl: h.thumbnailUrl ?? "",
      provider: h.provider ?? "",
      sourceUrl: h.sourceUrl,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách sạn"
        description="Khối gợi ý trên trang điểm đến — không có trang riêng, không qua duyệt (hotel-spec §2). Lưu sẽ publish thẳng lên website."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => autoAssign.mutate()}
              disabled={autoAssign.isPending}
            >
              {autoAssign.isPending ? "Đang tính..." : "Tính lại gán tự động theo khoảng cách"}
            </Button>
            <Button size="sm" className="whitespace-nowrap" onClick={() => setImportOpen(true)}>
              Nhập từ Sheet
            </Button>
          </>
        }
      />

      <FeatureIntro
        summary={
          <>
            Lưu ở đây là <strong>lên website ngay</strong>, không qua bước duyệt — kiểm tra kỹ
            trước khi bấm Lưu. Khách sạn tự hiện trong khối gợi ý ở trang điểm đến gần nhất.
          </>
        }
        details={
          <>
            &quot;Tính lại gán tự động theo khoảng cách&quot; chạy lại thuật toán gán khách sạn vào
            điểm đến gần nhất (dựa vào toạ độ lat/lng đã nhập) — bấm lại sau khi thêm/sửa hàng
            loạt khách sạn để khối gợi ý trên trang điểm đến cập nhật đúng. &quot;Nhập từ
            Sheet&quot; để thêm nhiều khách sạn cùng lúc thay vì nhập tay từng cái. Cần chọn
            &quot;Provider&quot; (đối tác affiliate) đã tạo sẵn ở trang Affiliate để link đặt phòng
            có gắn mã hoa hồng.
          </>
        }
      />

      <ImportHotelsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => queryClient.invalidateQueries({ queryKey: ["hotels"] })}
      />

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded border border-zinc-300 p-4 dark:border-zinc-700">
        <h3 className="mb-3 font-medium">{editingId ? "Sửa khách sạn" : "Thêm khách sạn"}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            className="md:col-span-2"
            placeholder="Tên khách sạn *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            placeholder="Mã tỉnh (vd: 22)"
            value={form.provinceCode}
            onChange={(e) => setForm((f) => ({ ...f, provinceCode: e.target.value }))}
          />
          <Input
            className="md:col-span-3"
            placeholder="Địa chỉ"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Input
            placeholder="Vĩ độ (lat)"
            value={form.lat}
            onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
          />
          <Input
            placeholder="Kinh độ (lng)"
            value={form.lng}
            onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
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
            className="md:col-span-2"
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
            {editingId ? "Lưu thay đổi" : "Tạo khách sạn"}
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
        {hotelsQuery.data?.map((h) => (
          <div
            key={h.id}
            className="flex items-center justify-between rounded border border-zinc-300 p-3 dark:border-zinc-700"
          >
            <div className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{h.name}</span>
                <Badge
                  tone={
                    h.linkStatus === "converted"
                      ? "emerald"
                      : h.linkStatus === "no-rule"
                        ? "amber"
                        : "gray"
                  }
                >
                  {h.linkStatus}
                </Badge>
                {h.siteId === null && <Badge tone="red">Chưa publish</Badge>}
              </div>
              <div className="text-xs text-zinc-500">
                {h.address ?? "—"} · Giá từ {h.priceFrom ?? "—"} · Rating {h.rating ?? "—"} ·{" "}
                {h.destinationCount} điểm đến đang gợi ý
              </div>
            </div>
            <Button size="sm" onClick={() => startEdit(h)}>
              Sửa
            </Button>
          </div>
        ))}
        {hotelsQuery.data?.length === 0 && (
          <p className="text-sm text-zinc-500">Chưa có khách sạn nào.</p>
        )}
      </div>
    </div>
  );
}
