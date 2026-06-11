/**
 * Port lay du lieu san pham tu CMS cu (.NET, read-only) — M2.
 * Implementations o infrastructure: MockProductCatalog (chua co CMS_BASE_URL)
 * va CmsHttpProductCatalog (goi API that). AI CHI duoc viet ve san pham trong day.
 */
export const PRODUCT_CATALOG = Symbol("PRODUCT_CATALOG");

/** Product context toi thieu de AI viet bai — KHONG cho AI tu che thong tin ngoai day. */
export interface ProductContext {
  name: string;
  url: string;
  price: string | null;
  description: string | null;
}

export interface ProductCatalogQuery {
  siteCode: string;
  topic: string;
  keywords: string[];
  /** So san pham toi da dua vao prompt (mac dinh 8 — du cho bai top-list). */
  limit?: number;
}

export interface ProductCatalog {
  findProducts(query: ProductCatalogQuery): Promise<ProductContext[]>;
}
