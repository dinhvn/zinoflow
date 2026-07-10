"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod/v4";
import { hotelSchema, type Hotel } from "@zinoflow/contracts";
import { apiGet, apiSend, ApiError } from "@/shared/api-client";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";

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

  const hotelsQuery = useQuery({
    queryKey: ["hotels"],
    queryFn: () => apiGet("/hotels", z.array(hotelSchema)),
  });

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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Khách sạn</h2>
          <p className="text-sm text-zinc-500">
            Khối gợi ý trên trang điểm đến — không có trang riêng, không qua duyệt (hotel-spec §2).
            Lưu sẽ publish thẳng lên website.
          </p>
        </div>
        <a href="/dichoithoi/khach-san/nhap" className="whitespace-nowrap text-sm text-blue-600 hover:underline dark:text-blue-400">
          Nhập từ Sheet →
        </a>
      </div>

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
          <Input
            placeholder="provider (vd: booking, agoda)"
            value={form.provider}
            onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
          />
          <Input
            className="md:col-span-2"
            placeholder="Link gốc (sourceUrl) *"
            value={form.sourceUrl}
            onChange={(e) => setForm((f) => ({ ...f, sourceUrl: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="primary"
            loading={save.isPending}
            disabled={!form.name.trim() || !form.sourceUrl.trim()}
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
