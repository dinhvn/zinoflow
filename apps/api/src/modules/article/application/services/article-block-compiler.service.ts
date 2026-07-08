import { Inject, Injectable } from "@nestjs/common";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { ArticleBlockError, ArticleBlockWarning } from "@zinoflow/contracts";
import {
  parseBlockTokens,
  resolveLimit,
  type ParsedBlockToken,
} from "../../../shared/text/block-token";
import {
  DICHOITHOI_SITE_DB,
  type DichoithoiSiteDb,
} from "../../../destination/application/ports/dichoithoi-site-db.port";
import { HOTEL_REPOSITORY, type HotelRepository } from "../../../hotel/application/ports/hotel.repository";
import { TOUR_REPOSITORY, type TourRepository } from "../../../tour/application/ports/tour.repository";
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from "../../../product/application/ports/product.repository";
import { matchProducts } from "../../../product/domain/product-matcher";
import { renderCardGrid, type CardItem } from "../../domain/card-template";

export interface CompiledArticle {
  html: string;
  errors: ArticleBlockError[];
  warnings: ArticleBlockWarning[];
  blockCount: number;
}

const SANITIZE_ALLOWLIST = {
  allowedTags: [
    "h2", "h3", "h4", "p", "br", "hr",
    "strong", "em", "b", "i", "u", "s", "blockquote",
    "ul", "ol", "li", "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
  ],
  allowedAttributes: {
    a: ["href", "title", "rel", "target"],
    img: ["src", "alt", "title", "loading"],
  },
  allowedSchemes: ["http", "https"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener", target: "_blank" }),
  },
};

/**
 * Engine compile khoi dong (dichoithoi-article-spec.md §4): RawContent (markdown
 * kem token) -> ContentHtml hoan chinh. Token loi cu phap/tham so khong ton tai
 * -> error (CHAN publish); token hop le nhung 0 ket qua -> warning + bo khoi
 * (khong render section rong).
 */
@Injectable()
export class ArticleBlockCompiler {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
  ) {}

  async compile(rawMarkdown: string): Promise<CompiledArticle> {
    const tokens = parseBlockTokens(rawMarkdown);
    const errors: ArticleBlockError[] = [];
    const warnings: ArticleBlockWarning[] = [];
    const lines = rawMarkdown.split("\n");

    const [validTypeSlugs, validProvinces] = await Promise.all([
      this.siteDb.fetchTypes(),
      this.siteDb.fetchProvinceSlugs(),
    ]);
    const typeSlugSet = new Set(validTypeSlugs.map((t) => t.slug));
    const provinceBySlug = new Map(validProvinces.map((p) => [p.slug, p]));

    const cardsByLine = new Map<number, string>();
    for (const token of tokens) {
      if (token.kind === null) {
        errors.push({ raw: token.raw, message: `Cú pháp khối không hợp lệ: "${token.raw}"` });
        continue;
      }
      const paramError = this.validateParams(token, typeSlugSet, provinceBySlug);
      if (paramError) {
        errors.push({ raw: token.raw, message: paramError });
        continue;
      }
    }

    // Co loi cu phap/tham so -> chan publish, khong can resolve du lieu (use-case se doc errors)
    if (errors.length > 0) {
      return { html: "", errors, warnings, blockCount: tokens.length };
    }

    for (const token of tokens) {
      const items = await this.resolveItems(token, provinceBySlug);
      if (items.length === 0) {
        warnings.push({
          raw: token.raw,
          message: `Khối "${token.raw}" trả về 0 kết quả — kiểm tra tham số hoặc bỏ khối`,
        });
        lines[token.lineIndex] = "";
        continue;
      }
      const placeholder = `{{ZF_BLOCK_${token.lineIndex}}}`;
      lines[token.lineIndex] = placeholder;
      cardsByLine.set(token.lineIndex, renderCardGrid(items));
    }

    const rawHtml = await marked.parse(lines.join("\n"), { async: true });
    let html = sanitizeHtml(rawHtml, SANITIZE_ALLOWLIST);
    for (const [lineIndex, cardHtml] of cardsByLine.entries()) {
      const placeholder = `{{ZF_BLOCK_${lineIndex}}}`;
      const wrapped = new RegExp(`<p>\\s*${placeholder}\\s*</p>`, "i");
      html = wrapped.test(html) ? html.replace(wrapped, cardHtml) : html.replace(placeholder, cardHtml);
    }

    return { html, errors, warnings, blockCount: tokens.length };
  }

  private validateParams(
    token: ParsedBlockToken,
    typeSlugs: Set<string>,
    provinces: Map<string, { code: string }>,
  ): string | null {
    if (token.params.type && !typeSlugs.has(token.params.type)) {
      return `Loại điểm đến "${token.params.type}" không tồn tại — kiểm tra lại tham số type`;
    }
    if (token.params.province && !provinces.has(token.params.province)) {
      return `Tỉnh "${token.params.province}" không tồn tại — kiểm tra lại tham số province`;
    }
    if (token.kind === "destination" && !token.params.slug) {
      return `Khối "destination" cần tham số slug (vd slug=thac-datanla)`;
    }
    if (token.kind === "product" && !token.params.id) {
      return `Khối "product" cần tham số id (vd id=xxxx-xxxx-xxxx)`;
    }
    if (token.kind === "products" && !token.params.tag) {
      return `Khối "products" cần tham số tag (vd tag=phuot,leu-trai)`;
    }
    return null;
  }

  private async resolveItems(
    token: ParsedBlockToken,
    provinces: Map<string, { code: string }>,
  ): Promise<CardItem[]> {
    const limit = resolveLimit(token.params);
    const sort = (token.params.sort as "featured" | "newest" | "order") ?? "featured";

    if (token.kind === "destination") {
      const row = await this.siteDb.findDestinationCardBySlug(token.params.slug!);
      if (!row) return [];
      return [
        {
          href: `/diem-den/${row.slug}`,
          name: row.name,
          thumbnailUrl: row.thumbnail,
          badge: null,
          meta: row.shortDescription,
        },
      ];
    }

    if (token.kind === "destinations") {
      const rows = await this.siteDb.findDestinationCards({
        typeSlug: token.params.type,
        provinceSlug: token.params.province,
        parentSlug: token.params.destination,
        limit,
        sort,
      });
      return rows.map((r) => ({
        href: `/diem-den/${r.slug}`,
        name: r.name,
        thumbnailUrl: r.thumbnail,
        badge: null,
        meta: r.shortDescription,
      }));
    }

    const provinceCode = token.params.province ? provinces.get(token.params.province)?.code : undefined;

    if (token.kind === "hotels") {
      const all = await this.hotels.findAll();
      const filtered = all
        .filter((h) => h.siteId !== null)
        .filter((h) => !provinceCode || h.provinceCode === provinceCode)
        .slice(0, limit);
      return filtered.map((h) => ({
        href: h.affiliateUrl ?? h.sourceUrl,
        name: h.name,
        thumbnailUrl: h.thumbnailUrl,
        badge: "Khách sạn",
        meta: h.priceFrom ? `Giá từ ${h.priceFrom.toLocaleString("vi-VN")}đ` : null,
      }));
    }

    if (token.kind === "tours") {
      const all = await this.tours.findAll();
      let filtered = all.filter((t) => t.siteId !== null);
      if (token.params.destination) {
        const forDestination = await this.tours.listForDestination(token.params.destination);
        const ids = new Set(forDestination.map((m) => m.tourId));
        filtered = filtered.filter((t) => ids.has(t.id));
      } else if (provinceCode) {
        filtered = filtered.filter((t) => t.provinceCode === provinceCode);
      }
      filtered = filtered.slice(0, limit);
      return filtered.map((t) => ({
        href: t.affiliateUrl ?? t.sourceUrl,
        name: t.name,
        thumbnailUrl: t.thumbnailUrl,
        badge: "Tour",
        meta: t.priceFrom ? `Giá từ ${t.priceFrom.toLocaleString("vi-VN")}đ` : null,
      }));
    }

    if (token.kind === "product") {
      const product = await this.products.findById(token.params.id!);
      if (!product || product.status !== 1) return [];
      return [
        {
          href: product.affiliateUrl ?? product.sourceUrl,
          name: product.name,
          thumbnailUrl: product.thumbnailUrl,
          badge: product.category,
          meta: product.price ? `${product.price.toLocaleString("vi-VN")}đ` : null,
        },
      ];
    }

    if (token.kind === "products") {
      const all = await this.products.findAll();
      const byId = new Map(all.map((p) => [p.id, p]));
      const matched = matchProducts(all, {
        tags: token.params.tag!.split(",").map((t) => t.trim()),
        category: token.params.category,
        limit,
      });
      return matched
        .map((m) => byId.get(m.id))
        .filter((p): p is (typeof all)[number] => p !== undefined)
        .map((p) => ({
          href: p.affiliateUrl ?? p.sourceUrl,
          name: p.name,
          thumbnailUrl: p.thumbnailUrl,
          badge: p.category,
          meta: p.price ? `${p.price.toLocaleString("vi-VN")}đ` : null,
        }));
    }

    return [];
  }
}
