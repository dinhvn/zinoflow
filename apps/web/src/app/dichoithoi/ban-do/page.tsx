"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  destinationTaxonomySchema,
  getDestinationsMapResponseSchema,
  getRelationsMapDataResponseSchema,
  getRelatedSpotlightResponseSchema,
  type DestinationMapItem,
} from "@zinoflow/contracts";
import { apiGet, apiSend } from "@/shared/api-client";
import { PageHeader } from "@/shared/ui/page-header";
import { Select } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { DestinationPoiDistanceTable } from "@/features/dichoithoi/destination-poi-distance-table";

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

const DISTANCE_LEVEL_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Mọi khoảng cách" },
  { value: "100", label: "≤ 100 km" },
  { value: "300", label: "≤ 300 km" },
];

function matchesStatus(item: DestinationMapItem, status: string): boolean {
  if (status === "") return true;
  if (status === "none") return item.siteId === null;
  return item.siteId !== null && String(item.siteStatus) === status;
}

/**
 * Bản đồ tổng quan toàn bộ điểm đến + lớp quan hệ (relations-plan §5.1-§5.7,
 * Giai đoạn A4 + C4). Chấm nhỏ = điểm lẻ (poi), chấm to = tỉnh/cụm; màu cam =
 * Flagship, xanh = Standard; mờ = điểm CHƯA publish. Bật "Hiện lớp quan hệ" để
 * xem: đường xám nhạt = khoảng cách cụm/tỉnh tự tính (lọc theo mức), đường tím
 * đậm = quan hệ curated tay (bấm vào để xoá), đường đỏ nét đứt = "spotlight" —
 * hiện khi bấm 1 điểm bất kỳ, vẽ đúng RelatedJson thật đã tính sẵn (tối đa 8
 * mục, bấm vào 1 đường đỏ để loại trừ gợi ý đó khỏi điểm đang chọn). Bật "Nối
 * tay" rồi bấm lần lượt 2 điểm để tạo quan hệ curated mới. Lọc tỉnh/trạng
 * thái/content tier chỉ ẩn/hiện marker, không đổi dữ liệu.
 *
 * Chọn "Xem cụm/tỉnh cụ thể" (map-cluster-view-plan.md Giai đoạn A-E) — thu
 * hẹp bản đồ về đúng 1 cụm/tỉnh + con của nó, tự zoom vừa khít, tắt gộp
 * marker (hiện hết không cần zoom tay), hiện tên từng điểm cạnh chấm, vẽ thêm
 * đường xanh lá = khoảng cách đường bộ thật con↔con (ORS, kéo thanh để lọc bớt
 * theo ngưỡng km khi rối), kèm bảng liệt kê đủ mọi cặp bên dưới bản đồ.
 */
export default function BanDoPage() {
  const [provinceCode, setProvinceCode] = useState("");
  const [status, setStatus] = useState("");
  const [tier, setTier] = useState("");
  const [focusSlug, setFocusSlug] = useState("");

  const [relationsOn, setRelationsOn] = useState(false);
  const [distanceLevel, setDistanceLevel] = useState("all");
  const [spotlightSlug, setSpotlightSlug] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectFirstSlug, setConnectFirstSlug] = useState<string | null>(null);
  const [manualPoiThresholdMeters, setManualPoiThresholdMeters] = useState<number | null>(null);

  const queryClient = useQueryClient();

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
  const relationsMapQuery = useQuery({
    queryKey: ["relations-map-data"],
    queryFn: () => apiGet("/destinations/relations-map-data", getRelationsMapDataResponseSchema),
    // Can khi bat lop quan he (duong tren ban do) HOAC da chon 1 cum cu the
    // (bang cap khoang cach Giai doan E doc lap voi toggle lop quan he).
    enabled: relationsOn || focusSlug !== "",
    staleTime: 30_000,
  });
  const spotlightQuery = useQuery({
    queryKey: ["related-spotlight", spotlightSlug],
    queryFn: () =>
      apiGet(`/destinations/${spotlightSlug}/related-spotlight`, getRelatedSpotlightResponseSchema),
    enabled: relationsOn && spotlightSlug !== null,
  });

  const manageCurated = useMutation({
    mutationFn: (vars: { sourceSlug: string; targetSlug: string; action: "add" | "remove" }) =>
      apiSend("POST", "/destinations/relations/curated", vars),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relations-map-data"] });
      queryClient.invalidateQueries({ queryKey: ["related-spotlight"] });
    },
  });
  const manageExcluded = useMutation({
    mutationFn: (vars: { sourceSlug: string; targetSlug: string; action: "add" | "remove" }) =>
      apiSend("POST", "/destinations/relations/excluded", vars),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["related-spotlight"] }),
  });

  const items = mapQuery.data?.items ?? [];

  // Danh sach cum/tinh de chon "xem 1 cum cu the" (map-cluster-view-plan.md Giai doan A)
  const focusOptions = useMemo(
    () =>
      items
        .filter((d) => d.kind === "cluster" || d.kind === "province")
        .sort((a, b) => a.name.localeCompare(b.name, "vi")),
    [items],
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (d) =>
          (provinceCode === "" || d.provinceCode === provinceCode) &&
          matchesStatus(d, status) &&
          (tier === "" || d.contentTier === tier) &&
          (focusSlug === "" || d.slug === focusSlug || d.parentSlug === focusSlug),
      ),
    [items, provinceCode, status, tier, focusSlug],
  );

  // Pham vi cum dang focus KHONG loc theo status/tier (khac `filtered`) — dung
  // rieng cho poi-distances vi khoang cach da tinh ca cho diem chua publish
  // (dichoithoi-poi-distance-plan.md Giai doan 2, bug thuc te 22/07/2026).
  const focusScopeSlugs = useMemo(() => {
    if (focusSlug === "") return null;
    return new Set(
      items.filter((d) => d.slug === focusSlug || d.parentSlug === focusSlug).map((d) => d.slug),
    );
  }, [items, focusSlug]);

  const poiDistancesInFocus = useMemo(() => {
    if (!focusScopeSlugs) return [];
    return (relationsMapQuery.data?.poiDistances ?? []).filter(
      (p) => focusScopeSlugs.has(p.poiASlug) && focusScopeSlugs.has(p.poiBSlug),
    );
  }, [relationsMapQuery.data, focusScopeSlugs]);

  const poiDistanceMaxMeters = useMemo(
    () => (poiDistancesInFocus.length > 0 ? Math.max(...poiDistancesInFocus.map((p) => p.distanceMeters)) : 0),
    [poiDistancesInFocus],
  );

  // "Vẽ hết" mac dinh (CHOT 23/07/2026) — null = theo max thuc te cua cum,
  // reset ve mac dinh moi khi doi cum de khong mang nguong cu sang cum khac.
  useEffect(() => {
    setManualPoiThresholdMeters(null);
  }, [focusSlug]);
  const effectivePoiThresholdMeters = manualPoiThresholdMeters ?? poiDistanceMaxMeters;
  const poiDistancesToDraw = useMemo(
    () => poiDistancesInFocus.filter((p) => p.distanceMeters <= effectivePoiThresholdMeters),
    [poiDistancesInFocus, effectivePoiThresholdMeters],
  );

  const itemsBySlug = useMemo(() => new Map(items.map((d) => [d.slug, d])), [items]);

  function handleMarkerClick(item: DestinationMapItem) {
    if (connectMode) {
      if (!connectFirstSlug) {
        setConnectFirstSlug(item.slug);
        return;
      }
      if (connectFirstSlug === item.slug) {
        setConnectFirstSlug(null); // bam lai chinh no -> huy chon
        return;
      }
      manageCurated.mutate({ sourceSlug: connectFirstSlug, targetSlug: item.slug, action: "add" });
      setConnectFirstSlug(null);
      return;
    }
    if (relationsOn) {
      setSpotlightSlug((prev) => (prev === item.slug ? null : item.slug));
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Bản đồ tổng quan điểm đến"
        description={`Hiện ${filtered.length}/${items.length} điểm đến trên bản đồ thật (OpenStreetMap) — dùng để QA toạ độ sai và xem khoảng trống nội dung theo khu vực. Bật "Hiện lớp quan hệ" để xem trực quan các quan hệ đã tính (khoảng cách cụm/tỉnh, quan hệ curated tay) và "spotlight" (bấm 1 điểm để xem RelatedJson thật của điểm đó, tối đa 8 mục, đường đỏ nét đứt). Bật "Nối tay" rồi bấm lần lượt 2 điểm để tạo quan hệ curated mới; bấm vào 1 đường quan hệ để xoá/loại trừ.`}
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
        <Select value={focusSlug} onChange={(e) => setFocusSlug(e.target.value)}>
          <option value="">Xem cụm/tỉnh cụ thể (tất cả)</option>
          {focusOptions.map((o) => (
            <option key={o.slug} value={o.slug}>
              {o.name}
              {o.provinceName && o.kind === "cluster" ? ` — ${o.provinceName}` : ""}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 p-2 dark:border-zinc-800">
        <Button
          size="sm"
          variant={relationsOn ? "primary" : "secondary"}
          onClick={() => {
            setRelationsOn((v) => !v);
            setSpotlightSlug(null);
            setConnectMode(false);
            setConnectFirstSlug(null);
          }}
        >
          {relationsOn ? "Đang hiện lớp quan hệ" : "Hiện lớp quan hệ"}
        </Button>
        {relationsOn && (
          <>
            <Select value={distanceLevel} onChange={(e) => setDistanceLevel(e.target.value)}>
              {DISTANCE_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant={connectMode ? "primary" : "secondary"}
              onClick={() => {
                setConnectMode((v) => !v);
                setConnectFirstSlug(null);
              }}
            >
              {connectMode ? "Đang nối tay — bấm 2 điểm liên tiếp" : "Nối tay"}
            </Button>
            {connectFirstSlug && (
              <span className="text-xs text-zinc-500">
                Đã chọn <strong>{connectFirstSlug}</strong> — bấm điểm thứ 2 để nối.
              </span>
            )}
            {spotlightSlug && (
              <span className="text-xs text-zinc-500">
                Spotlight: <strong>{spotlightSlug}</strong>
              </span>
            )}
            {focusSlug !== "" && poiDistancesInFocus.length > 0 && (
              <div className="w-full max-w-xs sm:w-56">
                <Slider
                  label="Lọc cặp con↔con theo ngưỡng"
                  display={`≤ ${(effectivePoiThresholdMeters / 1000).toFixed(1).replace(".", ",")} km (${poiDistancesToDraw.length}/${poiDistancesInFocus.length} cặp)`}
                  min={0}
                  max={poiDistanceMaxMeters}
                  step={Math.max(50, Math.round(poiDistanceMaxMeters / 200))}
                  value={effectivePoiThresholdMeters}
                  onChange={(e) => setManualPoiThresholdMeters(Number(e.target.value))}
                />
              </div>
            )}
          </>
        )}
      </div>

      {mapQuery.isLoading && <MapPlaceholder />}
      {mapQuery.isError && (
        <p className="text-sm text-red-600">Không tải được dữ liệu bản đồ: {String(mapQuery.error)}</p>
      )}
      {!mapQuery.isLoading && !mapQuery.isError && (
        <DestinationMapView
          items={filtered}
          allItems={items}
          focusSlug={focusSlug === "" ? null : focusSlug}
          onMarkerClick={handleMarkerClick}
          relationsLayer={{
            on: relationsOn,
            clusterDistances: relationsMapQuery.data?.clusterDistances ?? [],
            curatedRelations: relationsMapQuery.data?.curatedRelations ?? [],
            distanceLevelKm: distanceLevel === "all" ? null : Number(distanceLevel),
            spotlightSlug,
            spotlightItems: spotlightQuery.data?.items ?? [],
            poiDistances: poiDistancesToDraw,
            onRemoveCurated: (sourceSlug, targetSlug) =>
              manageCurated.mutate({ sourceSlug, targetSlug, action: "remove" }),
            onExcludeSpotlight: (sourceSlug, targetSlug) =>
              manageExcluded.mutate({ sourceSlug, targetSlug, action: "add" }),
          }}
        />
      )}

      {focusSlug !== "" && (
        <DestinationPoiDistanceTable pairs={poiDistancesInFocus} itemsBySlug={itemsBySlug} />
      )}
    </div>
  );
}
