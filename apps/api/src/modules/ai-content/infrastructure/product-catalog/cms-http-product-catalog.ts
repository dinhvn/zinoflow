import { Injectable, Logger } from "@nestjs/common";
import { z } from "zod/v4";
import type {
  ProductCatalog,
  ProductCatalogQuery,
  ProductContext,
} from "../../application/ports/product-catalog.port";
import { UpstreamApiError } from "../../../shared/errors/app-error";

/**
 * CMS (.NET) product catalog qua HTTP — read-only.
 *
 * GIA DINH endpoint (can xac nhan voi CMS that truoc khi bat len production):
 *   GET {CMS_BASE_URL}/api/products?siteCode=...&search=...&limit=...
 *   Header: x-api-key: {CMS_API_KEY}
 *   Response: { products: [{ name, url, price?, description? }] }
 * Neu contract CMS khac, CHI sua schema + mapping trong file nay.
 */
const cmsProductSchema = z.object({
  name: z.string(),
  url: z.string(),
  price: z.string().nullish(),
  description: z.string().nullish(),
});
const cmsProductsResponseSchema = z.object({
  products: z.array(cmsProductSchema),
});

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3; // 1 lan goi + 2 retry cho loi tam thoi
const RETRY_BASE_DELAY_MS = 1_000;

@Injectable()
export class CmsHttpProductCatalog implements ProductCatalog {
  private readonly logger = new Logger(CmsHttpProductCatalog.name);

  async findProducts(query: ProductCatalogQuery): Promise<ProductContext[]> {
    const baseUrl = process.env.CMS_BASE_URL;
    if (!baseUrl) {
      throw new UpstreamApiError("CMS_BASE_URL chua duoc cau hinh");
    }

    const url = new URL("/api/products", baseUrl);
    url.searchParams.set("siteCode", query.siteCode);
    url.searchParams.set("search", [query.topic, ...query.keywords].join(" "));
    url.searchParams.set("limit", String(query.limit ?? 8));

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            Accept: "application/json",
            ...(process.env.CMS_API_KEY ? { "x-api-key": process.env.CMS_API_KEY } : {}),
          },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        // 4xx la loi cau hinh/contract — retry khong giup gi
        if (response.status >= 400 && response.status < 500) {
          throw new UpstreamApiError(`CMS products API tra ${response.status}`, [
            await response.text().catch(() => ""),
          ]);
        }
        if (!response.ok) {
          throw new Error(`CMS products API tra ${response.status}`);
        }

        const parsed = cmsProductsResponseSchema.parse(await response.json());
        return parsed.products.map((p) => ({
          name: p.name,
          url: p.url,
          price: p.price ?? null,
          description: p.description ?? null,
        }));
      } catch (error) {
        if (error instanceof UpstreamApiError) throw error;
        lastError = error;
        this.logger.warn(
          `CMS products attempt ${attempt}/${MAX_ATTEMPTS} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, RETRY_BASE_DELAY_MS * attempt)); // backoff tuyen tinh
        }
      }
    }

    throw new UpstreamApiError(
      `CMS products API failed sau ${MAX_ATTEMPTS} lan thu`,
      [lastError instanceof Error ? lastError.message : String(lastError)],
    );
  }
}
