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
 * Tra ve TOAN BO ten file vat ly ung voi 1 path luu DB (thumbnail hoac gallery
 * item.path) — dung khi XOA anh that su khoi hosting (vd xoa han 1 diem den).
 * Anh MOI (3 bien the hero/medium/thumb, path la basename khong duoi hoac
 * dang "{base}-thumb.webp" cua thumbnail) -> 3 file; anh CU (1 file duy nhat,
 * path da la ten file day du .webp nhung KHONG theo mau "-thumb.webp") -> 1
 * file. Cung logic phan biet cu/moi voi resolveGalleryThumbPath o tren.
 */
export function resolveImageFilePaths(path: string): string[] {
  const lower = path.toLowerCase();
  if (lower.endsWith("-thumb.webp")) {
    const base = path.slice(0, -"-thumb.webp".length);
    return [`${base}-hero.webp`, `${base}-medium.webp`, `${base}-thumb.webp`];
  }
  if (lower.endsWith(".webp")) {
    return [path]; // anh cu, 1 file duy nhat
  }
  return [`${path}-hero.webp`, `${path}-medium.webp`, `${path}-thumb.webp`]; // gallery item MOI (basename)
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
