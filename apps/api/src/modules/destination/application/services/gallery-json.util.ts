import type { GalleryItem } from "@zinoflow/contracts";

/**
 * Anh CU (truoc 07/2026): `path` la ten file day du, VD "slug.webp" -> dung
 * thang. Anh MOI (co 3 co hero/medium/thumb): `path` la BASE NAME KHONG co
 * duoi file, VD "slug/gallery/ten-anh-123456" -> phai tu ghep "-thumb.webp"
 * de ra duong dan file that (dung logic phan biet voi `GalleryItemModel.
 * HasSizeVariants` ben repo dichoithoi — xem add-destination-gallery-image.usecase.ts).
 */
export function resolveGalleryThumbPath(path: string): string {
  return path.toLowerCase().endsWith(".webp") ? path : `${path}-thumb.webp`;
}

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
