import { z } from "zod/v4";

/**
 * Site + loai bai (PostType) cho khu CMS khuyenmai (laruki/dochoi3s).
 * Map sang gia tri so trong DB CMS (WordpressPost.SiteId / .PostType).
 * Spec: docs/specs/laruki-dochoi3s-content-spec.md.
 */

export const khuyenmaiSiteSchema = z.enum(["laruki", "dochoi3s"]);
export type KhuyenmaiSite = z.infer<typeof khuyenmaiSiteSchema>;

/** SiteId trong DB CMS: 1 = Laruki, 2 = Dochoi3s */
export const KHUYENMAI_SITE_ID: Record<KhuyenmaiSite, number> = { laruki: 1, dochoi3s: 2 };
export function khuyenmaiSiteFromId(id: number): KhuyenmaiSite | null {
  return id === 1 ? "laruki" : id === 2 ? "dochoi3s" : null;
}

/** PostContentType (CMS) — int trong WordpressPost.PostType. Slug dung cho articleType prompt. */
export const KHUYENMAI_POST_TYPES = [
  { id: 1, slug: "ds-khuyen-mai", label: "Danh sách khuyến mãi (1 supplier)" },
  { id: 2, slug: "ds-san-pham", label: "Danh sách sản phẩm khuyến mãi" },
  { id: 3, slug: "tong-hop-km", label: "Tổng hợp khuyến mãi (nhiều supplier)" },
  { id: 4, slug: "today-promotion", label: "Khuyến mãi hôm nay" },
  { id: 5, slug: "ma-giam-gia", label: "Mã giảm giá" },
  { id: 6, slug: "freeship-tiki", label: "Freeship Tiki" },
  { id: 7, slug: "product", label: "Sản phẩm" },
  { id: 8, slug: "update-only", label: "Chỉ update" },
  { id: 9, slug: "ma-gg-sach-tiki", label: "Mã GG Sách Tiki" },
  { id: 10, slug: "top-product", label: "Top sản phẩm" },
] as const;

export type KhuyenmaiPostTypeSlug = (typeof KHUYENMAI_POST_TYPES)[number]["slug"];

export function khuyenmaiPostTypeSlug(id: number | null): KhuyenmaiPostTypeSlug | null {
  return KHUYENMAI_POST_TYPES.find((t) => t.id === id)?.slug ?? null;
}
export function khuyenmaiPostTypeLabel(id: number | null): string {
  return KHUYENMAI_POST_TYPES.find((t) => t.id === id)?.label ?? "(chưa phân loại)";
}

/** articleType cho pipeline ai-content: "km-<postTypeSlug>" (fallback "km-bai-viet"). */
export function khuyenmaiArticleType(postTypeId: number | null): string {
  const slug = khuyenmaiPostTypeSlug(postTypeId);
  return slug ? `km-${slug}` : "km-bai-viet";
}
