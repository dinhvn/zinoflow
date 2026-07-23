"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type {
  ClusterDistancePairDto,
  CuratedRelationPairDto,
  DestinationMapItem,
  PoiDistancePairDto,
  RelatedSpotlightItem,
} from "@zinoflow/contracts";

const AUTO_LINE_COLOR = "#9ca3af"; // xam nhat — khoang cach tu tinh (§5.3)
const CURATED_LINE_COLOR = "#8b5cf6"; // tim — quan he curated tay, noi bat rieng (§5.3)
const SPOTLIGHT_LINE_COLOR = "#ef4444"; // do — spotlight RelatedJson that (§5.6)
const POI_DISTANCE_LINE_COLOR = "#22c55e"; // xanh la — khoang cach duong bo that con↔con (map-cluster-view-plan.md Giai doan D)

function formatKm(meters: number): string {
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

/**
 * Lop quan he tren ban do (relations-plan §5.3-§5.7, Giai doan C4) — nen tu
 * dong (xam nhat, khoang cach cum/tinh A2, loc theo muc), curated tay (tim
 * day hon, click de xoa), spotlight (do, chi hien khi chon 1 diem — RelatedJson
 * THAT da tinh san o C2, khong tinh lai), va con↔con cung cum (xanh la, chi
 * truyen khi trang cha da chon 1 cum/tinh cu the — map-cluster-view-plan.md
 * Giai doan D, du lieu ORS that tu dichoithoi_poi_distances). Ve imperative
 * qua L.polyline (dong bo cach `destination-map-cluster-layer.tsx` da lam cho
 * marker).
 */
export function DestinationMapRelationsLayer({
  allItems,
  clusterDistances,
  curatedRelations,
  distanceLevelKm,
  spotlightSlug,
  spotlightItems,
  poiDistances,
  onRemoveCurated,
  onExcludeSpotlight,
}: {
  allItems: DestinationMapItem[];
  clusterDistances: ClusterDistancePairDto[];
  curatedRelations: CuratedRelationPairDto[];
  distanceLevelKm: number | null;
  spotlightSlug: string | null;
  spotlightItems: RelatedSpotlightItem[];
  poiDistances: PoiDistancePairDto[];
  onRemoveCurated: (sourceSlug: string, targetSlug: string) => void;
  onExcludeSpotlight: (sourceSlug: string, targetSlug: string) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const coordBySlug = new Map<string, [number, number]>();
    for (const item of allItems) {
      if (item.lat !== null && item.lng !== null) coordBySlug.set(item.slug, [item.lat, item.lng]);
    }
    const curatedPairKeys = new Set(
      curatedRelations.map((r) => [r.sourceSlug, r.targetSlug].sort().join("|")),
    );

    const group = L.layerGroup();

    // 1) Nen tu dong — khoang cach cum/tinh (A2), loc theo muc
    for (const pair of clusterDistances) {
      if (distanceLevelKm !== null && pair.distanceMeters > distanceLevelKm * 1000) continue;
      const a = coordBySlug.get(pair.clusterASlug);
      const b = coordBySlug.get(pair.clusterBSlug);
      if (!a || !b) continue;
      L.polyline([a, b], { color: AUTO_LINE_COLOR, weight: 1, opacity: 0.5 })
        .bindTooltip(formatKm(pair.distanceMeters))
        .addTo(group);
    }

    // 2) Curated tay — tim, day hon, click de xoa (§5.7 muc 2)
    const drawnCurated = new Set<string>();
    for (const rel of curatedRelations) {
      const key = [rel.sourceSlug, rel.targetSlug].sort().join("|");
      if (drawnCurated.has(key)) continue; // ghi 2 chieu nhung chi ve 1 duong
      drawnCurated.add(key);
      const a = coordBySlug.get(rel.sourceSlug);
      const b = coordBySlug.get(rel.targetSlug);
      if (!a || !b) continue;
      const line = L.polyline([a, b], { color: CURATED_LINE_COLOR, weight: 3, opacity: 0.85 });
      line.on("click", () => {
        if (window.confirm(`Xoá quan hệ curated giữa 2 điểm này?`)) {
          onRemoveCurated(rel.sourceSlug, rel.targetSlug);
        }
      });
      line.addTo(group);
    }

    // 3) Spotlight — do, RelatedJson that cua diem dang chon (§5.6)
    if (spotlightSlug) {
      const selfCoord = coordBySlug.get(spotlightSlug);
      if (selfCoord) {
        for (const item of spotlightItems) {
          const targetCoord = coordBySlug.get(item.slug);
          if (!targetCoord) continue;
          const isCurated = curatedPairKeys.has([spotlightSlug, item.slug].sort().join("|"));
          const line = L.polyline([selfCoord, targetCoord], {
            color: SPOTLIGHT_LINE_COLOR,
            weight: 2.5,
            opacity: 0.9,
            dashArray: isCurated ? undefined : "6 4",
          }).bindTooltip(item.badge ?? item.name);
          line.on("click", () => {
            if (isCurated) {
              if (window.confirm(`Xoá quan hệ curated "${item.name}"?`)) {
                onRemoveCurated(spotlightSlug, item.slug);
              }
            } else if (window.confirm(`Loại trừ gợi ý "${item.name}" khỏi điểm này?`)) {
              onExcludeSpotlight(spotlightSlug, item.slug);
            }
          });
          line.addTo(group);
        }
      }
    }

    // 4) Con↔con cung cum — xanh la, du lieu ORS that, chi ve khi trang cha da
    // loc san (poiDistances rong khi chua chon cum, xem map-cluster-view-plan.md
    // Giai doan D2 — gate hien thi nam o trang cha, khong lap lai o day)
    for (const pair of poiDistances) {
      const a = coordBySlug.get(pair.poiASlug);
      const b = coordBySlug.get(pair.poiBSlug);
      if (!a || !b) continue;
      L.polyline([a, b], { color: POI_DISTANCE_LINE_COLOR, weight: 1.5, opacity: 0.7 })
        .bindTooltip(formatKm(pair.distanceMeters))
        .addTo(group);
    }

    group.addTo(map);
    return () => {
      map.removeLayer(group);
    };
  }, [
    map,
    allItems,
    clusterDistances,
    curatedRelations,
    distanceLevelKm,
    spotlightSlug,
    spotlightItems,
    poiDistances,
    onRemoveCurated,
    onExcludeSpotlight,
  ]);

  return null;
}
