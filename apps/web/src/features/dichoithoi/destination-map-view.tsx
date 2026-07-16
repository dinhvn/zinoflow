"use client";

import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { MapContainer, TileLayer } from "react-leaflet";
import type { DestinationMapItem } from "@zinoflow/contracts";
import { DestinationMapClusterLayer } from "./destination-map-cluster-layer";

/** Trung tam Viet Nam, zoom du thay ca nuoc — relations-plan §5.1 */
const VIETNAM_CENTER: [number, number] = [16.0, 106.0];
const VIETNAM_ZOOM = 5;

/**
 * Ban do that (Leaflet + OpenStreetMap, khong API key/khong tinh phi) hien TOAN BO
 * diem den — CHI dung trong CMS noi bo, khong phai website cong khai nen khong ap
 * dung nguyen tac "khong thu vien ngoai" (relations-plan §5.1). Phai load qua
 * next/dynamic({ ssr: false }) vi Leaflet dung `window`.
 */
export function DestinationMapView({ items }: { items: DestinationMapItem[] }) {
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
      <DestinationMapClusterLayer items={items} />
    </MapContainer>
  );
}
