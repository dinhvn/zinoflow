"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import type { DestinationMapItem } from "@zinoflow/contracts";

const SITE_BASE_URL = "https://dichoithoi.com";

function statusLabel(item: DestinationMapItem): string {
  if (item.siteId === null) return "Chưa publish";
  if (item.siteStatus === 1) return "Đã publish";
  if (item.siteStatus === 0) return "Draft";
  return "Đã ẩn";
}

/** Chấm to/nhỏ theo kind (tỉnh/cụm to hơn poi), màu theo ContentTier — 1 chiều màu chính
 * (relations-plan §5.2), mờ đi neu chua publish de de nhan ra khi QA du lieu. */
function iconFor(item: DestinationMapItem): L.DivIcon {
  const size = item.kind === "poi" ? 10 : 18;
  const color = item.contentTier === "flagship" ? "#f59e0b" : "#3b82f6";
  const opacity = item.siteStatus === 1 ? 1 : 0.45;
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};opacity:${opacity};border:1.5px solid white;box-shadow:0 0 2px rgba(0,0,0,.5)"></span>`,
    iconSize: [size, size],
  });
}

/** Xay popup bang DOM API (khong innerHTML) vi ten diem den la du lieu nguoi dung nhap tay. */
function buildPopupContent(item: DestinationMapItem): HTMLElement {
  const root = document.createElement("div");
  root.className = "text-sm";

  const title = document.createElement("div");
  title.className = "font-semibold text-zinc-900";
  title.textContent = item.name;
  root.appendChild(title);

  if (item.imageUrl) {
    const img = document.createElement("img");
    img.src = item.imageUrl;
    img.alt = item.name;
    img.className = "mt-1 h-16 w-24 rounded object-cover";
    root.appendChild(img);
  }

  const status = document.createElement("div");
  status.className = "mt-1 text-xs text-zinc-500";
  status.textContent = `${statusLabel(item)}${item.provinceName ? ` — ${item.provinceName}` : ""}`;
  root.appendChild(status);

  const links = document.createElement("div");
  links.className = "mt-2 flex gap-3 text-xs";

  const editLink = document.createElement("a");
  editLink.href = `/dichoithoi/${item.slug}`;
  editLink.textContent = "Sửa";
  editLink.className = "text-blue-600 underline";
  links.appendChild(editLink);

  if (item.siteId !== null && item.siteStatus === 1) {
    const viewLink = document.createElement("a");
    viewLink.href = `${SITE_BASE_URL}/diem-den/${item.slug}`;
    viewLink.target = "_blank";
    viewLink.rel = "noreferrer";
    viewLink.textContent = "Xem trên web ↗";
    viewLink.className = "text-blue-600 underline";
    links.appendChild(viewLink);
  }
  root.appendChild(links);

  return root;
}

/**
 * Lop marker gom cum (leaflet.markercluster) tren nen MapContainer — chi ve marker,
 * khong tu quan ly zoom/tile (relations-plan §5.1-5.2, Giai doan A4 — CHUA co lop
 * quan he/duong noi, xem Giai doan C4).
 */
export function DestinationMapClusterLayer({
  items,
  onMarkerClick,
  disableClustering = false,
}: {
  items: DestinationMapItem[];
  /** Bao cho trang cha khi click 1 marker — dung cho lop quan he (spotlight/noi
   * tay, relations-plan §5.6-§5.7, Giai doan C4). Khong thay the popup, ca 2 cung xay ra. */
  onMarkerClick?: (item: DestinationMapItem) => void;
  /** Da chon 1 cum/tinh cu the tren trang cha (map-cluster-view-plan.md Giai doan
   * A/B/C) — tat gom cum (chi con vai chuc diem, hien het khong can zoom) +
   * hien ten thuong truc canh moi marker thay vi chi trong popup. */
  disableClustering?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const group: L.LayerGroup = disableClustering ? L.layerGroup() : L.markerClusterGroup();
    for (const item of items) {
      if (item.lat === null || item.lng === null) continue;
      const marker = L.marker([item.lat, item.lng], { icon: iconFor(item) });
      marker.bindPopup(buildPopupContent(item));
      if (disableClustering) {
        marker.bindTooltip(item.name, {
          permanent: true,
          direction: "top",
          offset: [0, -4],
          className: "!rounded !border-none !bg-white/90 !px-1.5 !py-0.5 !text-xs !shadow",
        });
      }
      if (onMarkerClick) marker.on("click", () => onMarkerClick(item));
      group.addLayer(marker);
    }
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
    };
  }, [items, map, onMarkerClick, disableClustering]);

  return null;
}
