import { Injectable, Logger } from "@nestjs/common";
import {
  computeDiscountPercent,
  type ProductBadge,
  type ProductCell,
  type ProductSearchQuery,
  type ProductSearchResult,
} from "@zinoflow/contracts";
import type { ProductCatalog } from "../../application/ports/product-catalog.port";

const TIMEOUT_MS = 12_000;

/**
 * Adapter goi CMS cu /api/v1/product/search (spec §12).
 * Key auth + base URL tu env (CMS_PRODUCT_API_BASE_URL, CMS_PRODUCT_API_KEY).
 * Response CMS chua chuan -> normalize linh hoat ve ProductCell (anh tuyet doi, % giam).
 */
@Injectable()
export class HttpProductCatalogAdapter implements ProductCatalog {
  private readonly logger = new Logger(HttpProductCatalogAdapter.name);

  async search(query: ProductSearchQuery): Promise<ProductSearchResult> {
    const base = process.env.CMS_PRODUCT_API_BASE_URL;
    const key = process.env.CMS_PRODUCT_API_KEY;
    if (!base || !key) {
      this.logger.warn("CMS_PRODUCT_API_BASE_URL / CMS_PRODUCT_API_KEY chua cau hinh");
      return { items: [], total: 0, page: query.page, limit: query.limit };
    }

    const url = new URL(`${base.replace(/\/+$/, "")}/api/v1/product/search`);
    url.searchParams.set("key", key);
    if (query.keyword) url.searchParams.set("keyword", query.keyword);
    if (query.supplierCode) url.searchParams.set("supplierCode", query.supplierCode);
    if (query.categoryCode) url.searchParams.set("categoryCode", query.categoryCode);
    for (const flag of ["isDiscount", "isNew", "isHot", "isChanged", "isFixedProduct"] as const) {
      if (query[flag]) url.searchParams.set(flag, "true");
    }
    url.searchParams.set("page", String(query.page));
    url.searchParams.set("pageSize", String(query.limit));

    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`CMS product search loi ${res.status}`);
    }
    const raw = (await res.json()) as unknown;
    return this.normalize(raw, query);
  }

  /** Doc linh hoat: ho tro { items, total } hoac mang phang. */
  private normalize(raw: unknown, query: ProductSearchQuery): ProductSearchResult {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(raw)
      ? raw
      : (obj.items ?? obj.data ?? obj.results ?? []) as unknown[];
    const total = Number(obj.total ?? obj.totalCount ?? (Array.isArray(rawItems) ? rawItems.length : 0));

    const items = (Array.isArray(rawItems) ? rawItems : [])
      .map((r) => this.toCell(r as Record<string, unknown>))
      .filter((c): c is ProductCell => c !== null);

    return { items, total: Number.isFinite(total) ? total : items.length, page: query.page, limit: query.limit };
  }

  private toCell(r: Record<string, unknown>): ProductCell | null {
    const id = str(r.id ?? r.code ?? r.productCode ?? r.sku);
    const name = str(r.name ?? r.title ?? r.productName);
    const imageUrl = this.absoluteUrl(str(r.imageUrl ?? r.image ?? r.thumbnail ?? r.photo));
    if (!id || !name || !imageUrl) return null;

    const originalPrice = num(r.originalPrice ?? r.price ?? r.listPrice);
    const salePrice = num(r.salePrice ?? r.discountPrice ?? r.finalPrice);
    const discountPercent =
      num(r.discountPercent ?? r.discount) ?? computeDiscountPercent(originalPrice, salePrice);

    const badges: ProductBadge[] = [];
    if (truthy(r.isNew)) badges.push("new");
    if (truthy(r.isHot)) badges.push("hot");
    if (truthy(r.isDiscount) || (discountPercent ?? 0) > 0) badges.push("sale");

    return {
      id,
      name,
      imageUrl,
      originalPrice: originalPrice ?? null,
      salePrice: salePrice ?? null,
      discountPercent: discountPercent ?? null,
      badges,
      imageFitOverride: null,
    };
  }

  /** Anh phai tuyet doi (spec §12) — ghep base media neu CMS tra relative. */
  private absoluteUrl(value: string | null): string | null {
    if (!value) return null;
    if (/^https?:\/\//i.test(value)) return value;
    const mediaBase = process.env.CMS_MEDIA_BASE_URL?.replace(/\/+$/, "");
    if (!mediaBase) return value;
    return `${mediaBase}/${value.replace(/^\/+/, "")}`;
  }
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function truthy(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}
