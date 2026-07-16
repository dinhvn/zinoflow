"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  destinationTaxonomySchema,
  getDestinationsMapResponseSchema,
  type DestinationMapItem,
} from "@zinoflow/contracts";
import { apiGet } from "@/shared/api-client";
import { PageHeader } from "@/shared/ui/page-header";
import { Select } from "@/shared/ui/select";

// Leaflet dung truc tiep `window` — phai tat SSR (relations-plan §5.1, Giai doan A4).
const DestinationMapView = dynamic(
  () => import("@/features/dichoithoi/destination-map-view").then((m) => m.DestinationMapView),
  { ssr: false, loading: () => <MapPlaceholder /> },
);

function MapPlaceholder() {
  return (
    <div className="flex h-[70vh] w-full items-center justify-center rounded-lg border border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
      Đang tải bản đồ...
    </div>
  );
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Trạng thái (tất cả)" },
  { value: "1", label: "Đã publish" },
  { value: "0", label: "Draft" },
  { value: "2", label: "Đã ẩn" },
  { value: "none", label: "Chưa publish" },
];

const TIER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Content tier (tất cả)" },
  { value: "flagship", label: "Flagship" },
  { value: "standard", label: "Standard" },
];

function matchesStatus(item: DestinationMapItem, status: string): boolean {
  if (status === "") return true;
  if (status === "none") return item.siteId === null;
  return item.siteId !== null && String(item.siteStatus) === status;
}

/**
 * Bản đồ tổng quan toàn bộ điểm đến (relations-plan §5.1-5.2, Giai đoạn A4 — nền,
 * chưa có lớp quan hệ/khoảng cách, xem Giai đoạn C4). Chấm nhỏ = điểm lẻ (poi), chấm
 * to = tỉnh/cụm; màu cam = Flagship, xanh = Standard; mờ = điểm CHƯA publish. Click 1
 * chấm để xem nhanh + link sửa/xem web. Lọc theo tỉnh/trạng thái/content tier chỉ ẩn/hiện
 * trên bản đồ, KHÔNG đổi dữ liệu. Dùng để QA nhanh toạ độ sai và xem khoảng trống nội dung
 * theo khu vực.
 */
export default function BanDoPage() {
  const [provinceCode, setProvinceCode] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");

  const mapQuery = useQuery({
    queryKey: ["destinations-map"],
    queryFn: () => apiGet("/destinations/map", getDestinationsMapResponseSchema),
    staleTime: 60_000,
  });
  const taxonomyQuery = useQuery({
    queryKey: ["destination-taxonomy"],
    queryFn: () => apiGet("/destinations/taxonomy", destinationTaxonomySchema),
    staleTime: 10 * 60 * 1000,
  });

  const items = mapQuery.data?.items ?? [];
  const filtered = useMemo(
    () =>
      items.filter(
        (d) =>
          (provinceCode === "" || d.provinceCode === provinceCode) &&
          matchesStatus(d, status) &&
          (tier === "" || d.contentTier === tier),
      ),
    [items, provinceCode, status, tier],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bản đồ tổng quan điểm đến"
        description={`Hiện ${filtered.length}/${items.length} điểm đến trên bản đồ thật (OpenStreetMap) — dùng để QA toạ độ sai (chấm lệch vị trí rõ ràng) và xem khoảng trống nội dung theo khu vực. Bấm 1 chấm để xem nhanh + link sửa/xem trên web. Lọc chỉ ẩn/hiện, không đổi dữ liệu.`}
      />

      <div className="flex flex-wrap gap-2">
        <Select value={provinceCode} onChange={(e) => setProvinceCode(e.target.value)}>
          <option value="">Tỉnh/thành (tất cả)</option>
          {taxonomyQuery.data?.provinces.map((p) => (
            <option key={p.provinceCode} value={p.provinceCode}>
              {p.shortName}
            </option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select value={tier} onChange={(e) => setTier(e.target.value)}>
          {TIER_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {mapQuery.isLoading && <MapPlaceholder />}
      {mapQuery.isError && (
        <p className="text-sm text-red-600">Không tải được dữ liệu bản đồ: {String(mapQuery.error)}</p>
      )}
      {!mapQuery.isLoading && !mapQuery.isError && <DestinationMapView items={filtered} />}
    </div>
  );
}
