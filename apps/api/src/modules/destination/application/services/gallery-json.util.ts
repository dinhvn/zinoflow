import type { GalleryItem } from "@zinoflow/contracts";

/**
 * Serialize gallery sang JSON dung cho cot GalleryJson (SQL Server) — PHAI dung
 * key PascalCase khop CHINH XAC model C# `GalleryItemModel` (Path/AltText/Caption/
 * Credit) ben DiChoiThoi.Web, KHONG dua vao camelCase mac dinh cua JS object.
 */
export function buildGalleryJson(gallery: readonly GalleryItem[]): string {
  return JSON.stringify(
    gallery.map((item) => ({
      Path: item.path,
      AltText: item.altText,
      Caption: item.caption,
      Credit: item.credit,
    })),
  );
}
