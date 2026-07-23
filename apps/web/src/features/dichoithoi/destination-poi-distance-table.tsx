"use client";

import { useMemo } from "react";
import type { DestinationMapItem, PoiDistancePairDto } from "@zinoflow/contracts";
import { DataTable, type DataTableColumn } from "@/shared/ui";

interface PoiDistanceRow {
  key: string;
  nameA: string;
  nameB: string;
  distanceMeters: number;
}

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * Bang liet ke TOAN BO cap + khoang cach con↔con trong cum dang xem (map-
 * cluster-view-plan.md Giai doan E) — QA data list, KHONG loc theo nguong
 * slider cua lop ve duong (luon hien du moi cap, sort tang dan theo khoang
 * cach). Chi hien khi trang cha da chon 1 cum/tinh cu the.
 */
export function DestinationPoiDistanceTable({
  pairs,
  itemsBySlug,
}: {
  pairs: PoiDistancePairDto[];
  itemsBySlug: Map<string, DestinationMapItem>;
}) {
  const rows = useMemo<PoiDistanceRow[]>(
    () =>
      pairs
        .map((p) => ({
          key: `${p.poiASlug}|${p.poiBSlug}`,
          nameA: itemsBySlug.get(p.poiASlug)?.name ?? p.poiASlug,
          nameB: itemsBySlug.get(p.poiBSlug)?.name ?? p.poiBSlug,
          distanceMeters: p.distanceMeters,
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters),
    [pairs, itemsBySlug],
  );

  const columns: DataTableColumn<PoiDistanceRow>[] = [
    { key: "nameA", header: "Điểm A", render: (r) => r.nameA },
    { key: "nameB", header: "Điểm B", render: (r) => r.nameB },
    {
      key: "distanceMeters",
      header: "Khoảng cách (đường bộ)",
      align: "right",
      render: (r) => formatKm(r.distanceMeters),
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">
        Toàn bộ {rows.length} cặp khoảng cách đường bộ thật (OpenRouteService) trong cụm đang xem —
        sắp xếp gần nhất trước.
      </p>
      <DataTable columns={columns} items={rows} rowKey={(r) => r.key} emptyMessage="Chưa có dữ liệu khoảng cách — bấm 'Tính khoảng cách' ở trang /dichoithoi cho cụm này trước." />
    </div>
  );
}
