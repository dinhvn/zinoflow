"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapContainer, TileLayer } from "react-leaflet";
import type {
  ClusterDistancePairDto,
  CuratedRelationPairDto,
  DestinationMapItem,
  RelatedSpotlightItem,
} from "@zinoflow/contracts";
import { DestinationMapClusterLayer } from "./destination-map-cluster-layer";
import { DestinationMapRelationsLayer } from "./destination-map-relations-layer";

/** Trung tam Viet Nam, zoom du thay ca nuoc — relations-plan §5.1 */
const VIETNAM_CENTER: [number, number] = [16.0, 106.0];
const VIETNAM_ZOOM = 5;

/**
 * Ban do that (Leaflet + OpenStreetMap, khong API key/khong tinh phi) hien TOAN BO
 * diem den — CHI dung trong CMS noi bo, khong phai website cong khai nen khong ap
 * dung nguyen tac "khong thu vien ngoai" (relations-plan §5.1). Phai load qua
 * next/dynamic({ ssr: false }) vi Leaflet dung `window`. `items` da loc theo bo loc
 * trang cha (chi anh huong marker); lop quan he (relations-plan §5.3-§5.7, Giai
 * doan C4) luon dung `allItems` (khong loc) de tra toa do cho dung du item bi an.
 */
export function DestinationMapView({
  items,
  allItems,
  onMarkerClick,
  relationsLayer,
}: {
  items: DestinationMapItem[];
  allItems: DestinationMapItem[];
  onMarkerClick?: (item: DestinationMapItem) => void;
  relationsLayer: {
    on: boolean;
    clusterDistances: ClusterDistancePairDto[];
    curatedRelations: CuratedRelationPairDto[];
    distanceLevelKm: number | null;
    spotlightSlug: string | null;
    spotlightItems: RelatedSpotlightItem[];
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
      <DestinationMapClusterLayer items={items} onMarkerClick={onMarkerClick} />
      {relationsLayer.on && (
        <DestinationMapRelationsLayer
          allItems={allItems}
          clusterDistances={relationsLayer.clusterDistances}
          curatedRelations={relationsLayer.curatedRelations}
          distanceLevelKm={relationsLayer.distanceLevelKm}
          spotlightSlug={relationsLayer.spotlightSlug}
          spotlightItems={relationsLayer.spotlightItems}
          onRemoveCurated={relationsLayer.onRemoveCurated}
          onExcludeSpotlight={relationsLayer.onExcludeSpotlight}
        />
      )}
    </MapContainer>
  );
}
