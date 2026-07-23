"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type {
  ClusterDistancePairDto,
  CuratedRelationPairDto,
  DestinationMapItem,
  PoiDistancePairDto,
  RelatedSpotlightItem,
} from "@zinoflow/contracts";
import { DestinationMapClusterLayer } from "./destination-map-cluster-layer";
import { DestinationMapRelationsLayer } from "./destination-map-relations-layer";

/** Trung tam Viet Nam, zoom du thay ca nuoc — relations-plan §5.1 */
const VIETNAM_CENTER: [number, number] = [16.0, 106.0];
const VIETNAM_ZOOM = 5;

/**
 * Da chon 1 cum/tinh cu the (map-cluster-view-plan.md Giai doan A) — tu dong
 * zoom/pan toi vua khop moi marker con lai, khong can zoom tay. Chi chay khi
 * `active` (co focusSlug) de khong pha vi tri xem cua nguoi dung luc duyet ca
 * nuoc (hanh vi cu, khong doi).
 */
function MapFitBounds({ items, active }: { items: DestinationMapItem[]; active: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!active) return;
    const coords: [number, number][] = [];
    for (const item of items) {
      if (item.lat !== null && item.lng !== null) coords.push([item.lat, item.lng]);
    }
    if (coords.length === 0) return;
    map.fitBounds(coords, { padding: [40, 40], maxZoom: 14 });
  }, [active, items, map]);
  return null;
}

/**
 * Ban do that (Leaflet + OpenStreetMap, khong API key/khong tinh phi) hien TOAN BO
 * diem den — CHI dung trong CMS noi bo, khong phai website cong khai nen khong ap
 * dung nguyen tac "khong thu vien ngoai" (relations-plan §5.1). Phai load qua
 * next/dynamic({ ssr: false }) vi Leaflet dung `window`. `items` da loc theo bo loc
 * trang cha (chi anh huong marker); lop quan he (relations-plan §5.3-§5.7, Giai
 * doan C4) luon dung `allItems` (khong loc) de tra toa do cho dung du item bi an.
 * `focusSlug` != null (map-cluster-view-plan.md Giai doan A-D) — da chon 1 cum/
 * tinh cu the: tu fit bounds, tat marker clustering, hien ten thuong truc, ve
 * them duong quan he con↔con qua `relationsLayer.poiDistances`.
 */
export function DestinationMapView({
  items,
  allItems,
  focusSlug,
  onMarkerClick,
  relationsLayer,
}: {
  items: DestinationMapItem[];
  allItems: DestinationMapItem[];
  focusSlug: string | null;
  onMarkerClick?: (item: DestinationMapItem) => void;
  relationsLayer: {
    on: boolean;
    clusterDistances: ClusterDistancePairDto[];
    curatedRelations: CuratedRelationPairDto[];
    distanceLevelKm: number | null;
    spotlightSlug: string | null;
    spotlightItems: RelatedSpotlightItem[];
    /** Cap con↔con da loc theo cum dang focus + nguong slider (rong neu chua
     * chon cum) — map-cluster-view-plan.md Giai doan D. */
    poiDistances: PoiDistancePairDto[];
    onRemoveCurated: (sourceSlug: string, targetSlug: string) => void;
    onExcludeSpotlight: (sourceSlug: string, targetSlug: string) => void;
  };
}) {
  return (
    <MapContainer
      center={VIETNAM_CENTER}
      zoom={VIETNAM_ZOOM}
      style={{ height: "70vh", width: "100%" }}
      className="rounded-lg border border-zinc-200 dark:border-zinc-800"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFitBounds items={items} active={focusSlug !== null} />
      <DestinationMapClusterLayer
        items={items}
        onMarkerClick={onMarkerClick}
        disableClustering={focusSlug !== null}
      />
      {relationsLayer.on && (
        <DestinationMapRelationsLayer
          allItems={allItems}
          clusterDistances={relationsLayer.clusterDistances}
          curatedRelations={relationsLayer.curatedRelations}
          distanceLevelKm={relationsLayer.distanceLevelKm}
          spotlightSlug={relationsLayer.spotlightSlug}
          spotlightItems={relationsLayer.spotlightItems}
          poiDistances={relationsLayer.poiDistances}
          onRemoveCurated={relationsLayer.onRemoveCurated}
          onExcludeSpotlight={relationsLayer.onExcludeSpotlight}
        />
      )}
    </MapContainer>
  );
}
