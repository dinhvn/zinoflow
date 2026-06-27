import { Injectable, Logger } from "@nestjs/common";
import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import {
  computeDiscountPercent,
  type CategoryOption,
  type ProductBadge,
  type ProductCell,
  type ProductSearchQuery,
  type ProductSearchResult,
  type SupplierOption,
} from "@zinoflow/contracts";
import type { ProductCatalog } from "../../application/ports/product-catalog.port";

const TIMEOUT_MS = 15_000;

/**
 * Adapter goi CMS cu /api/v1/product/search (spec §12).
 * Base URL + key auth tu env (CMS_PRODUCT_API_BASE_URL, CMS_PRODUCT_API_KEY).
 * Response CMS: { rows[], total, page, limit, totalPages }. Mỗi row: id, name, image,
 * price (gia ban), oldPrice (gia goc), discount (%), isNew/isHot...
 * CMS_PRODUCT_API_INSECURE_TLS=true -> bo qua cert self-signed (dev https localhost).
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

    const raw = await this.getJson(url);
    return this.normalize(raw, query);
  }

  async listSuppliers(): Promise<SupplierOption[]> {
    const raw = await this.getCmsJson("/api/v1/suppliers");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) => r as Record<string, unknown>)
      .map((r) => ({ code: str(r.code ?? r.value) ?? "", name: str(r.name ?? r.text) ?? "" }))
      .filter((o) => o.code && o.name);
  }

  async listCategories(): Promise<CategoryOption[]> {
    const raw = await this.getCmsJson("/api/v1/categories");
    if (!Array.isArray(raw)) return [];
    return raw
      .map((r) => r as Record<string, unknown>)
      .map((r) => ({
        code: str(r.code ?? r.value) ?? "",
        name: str(r.name ?? r.text) ?? "",
        level: num(r.level) ?? 1,
        path: str(r.path) ?? "",
      }))
      .filter((o) => o.code && o.name);
  }

  /** GET JSON tu 1 path cua CMS (ghep base + key). Tra null neu chua cau hinh. */
  private getCmsJson(path: string): Promise<unknown> {
    const base = process.env.CMS_PRODUCT_API_BASE_URL;
    const key = process.env.CMS_PRODUCT_API_KEY;
    if (!base || !key) {
      this.logger.warn("CMS_PRODUCT_API_BASE_URL / CMS_PRODUCT_API_KEY chua cau hinh");
      return Promise.resolve([]);
    }
    const url = new URL(`${base.replace(/\/+$/, "")}${path}`);
    url.searchParams.set("key", key);
    return this.getJson(url);
  }

  /** GET JSON qua node:http(s) — kiem soat TLS (cho phep self-signed khi bat env flag). */
  private getJson(url: URL): Promise<unknown> {
    const insecure = process.env.CMS_PRODUCT_API_INSECURE_TLS === "true";
    const isHttps = url.protocol === "https:";
    const requestFn = isHttps ? httpsRequest : httpRequest;

    return new Promise((resolve, reject) => {
      const req = requestFn(
        url,
        { method: "GET", timeout: TIMEOUT_MS, ...(isHttps ? { rejectUnauthorized: !insecure } : {}) },
        (res) => {
          const status = res.statusCode ?? 0;
          const chunks: Buffer[] = [];
          res.on("data", (c: Buffer) => chunks.push(c));
          res.on("end", () => {
            const body = Buffer.concat(chunks).toString("utf8");
            if (status < 200 || status >= 300) {
              reject(new Error(`CMS product search loi ${status}: ${body.slice(0, 200)}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error("CMS tra ve khong phai JSON hop le"));
            }
          });
        },
      );
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("CMS product search timeout")));
      req.end();
    });
  }

  /** Doc { rows, total, page, limit } (fallback items/data cho linh hoat). */
  private normalize(raw: unknown, query: ProductSearchQuery): ProductSearchResult {
    const obj = (raw ?? {}) as Record<string, unknown>;
    const rawItems = Array.isArray(raw)
      ? raw
      : ((obj.rows ?? obj.items ?? obj.data ?? obj.results ?? []) as unknown[]);
    const total = Number(obj.total ?? obj.totalCount ?? (Array.isArray(rawItems) ? rawItems.length : 0));

    const items = (Array.isArray(rawItems) ? rawItems : [])
      .map((r) => this.toCell(r as Record<string, unknown>))
      .filter((c): c is ProductCell => c !== null);

    return {
      items,
      total: Number.isFinite(total) ? total : items.length,
      page: query.page,
      limit: query.limit,
    };
  }

  private toCell(r: Record<string, unknown>): ProductCell | null {
    const id = str(r.id ?? r.code ?? r.productCode ?? r.sku);
    const name = str(r.name ?? r.title ?? r.productName);
    const imageUrl = this.absoluteUrl(str(r.image ?? r.imageUrl ?? r.thumbnail ?? r.photo));
    if (!id || !name || !imageUrl) return null;

    // CMS: price = gia ban hien tai, oldPrice = gia goc gach.
    const salePrice = num(r.price ?? r.salePrice ?? r.finalPrice);
    const originalPrice = num(r.oldPrice ?? r.originalPrice ?? r.listPrice);
    const discountPercent =
      num(r.discount ?? r.discountPercent) ?? computeDiscountPercent(originalPrice, salePrice);

    const badges: ProductBadge[] = [];
    if (truthy(r.isNew)) badges.push("new");
    if (truthy(r.isHot)) badges.push("hot");
    if ((discountPercent ?? 0) > 0) badges.push("sale");

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
