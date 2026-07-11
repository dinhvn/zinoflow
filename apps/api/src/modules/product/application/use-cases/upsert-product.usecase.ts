import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Product, UpsertProductRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  PRODUCT_REPOSITORY,
  type ProductRecord,
  type ProductRepository,
  type UpsertProductInput,
} from "../ports/product.repository";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { IngestExternalImageUseCase } from "../../../shared/media/application/ingest-external-image.usecase";
import { productToDto } from "./list-products.usecase";
import { RecomputeSouvenirProductsUseCase } from "./recompute-souvenir-products.usecase";

const PRODUCT_FTP_BASE_DIR_ENV = "DICHOITHOI_FTP_PRODUCT_BASE_DIR";

/**
 * Tao moi / sua san pham — nhap tay, publish THANG (khong AI, khong 2 chot
 * duyet, khong dong bo SQL Server — product-spec §2/§5). affiliateUrl tinh
 * qua AffiliateLinkResolver luc luu, cung co che voi Hotel/Tour/ticketLinks.
 *
 * thumbnailUrl — neu la URL ngoai (Shopee/Lazada/Tiki...) thi ingest ve
 * hosting minh truoc khi luu (destination-spec §14.5, backlog §B Phase C
 * muc 3), giong co che dung cho Hotel/Tour. Ingest loi -> giu URL ngoai
 * tam thoi, khong chan luu.
 */
@Injectable()
export class UpsertProductUseCase {
  private readonly logger = new Logger(UpsertProductUseCase.name);

  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly ingestImage: IngestExternalImageUseCase,
    private readonly recomputeSouvenirProducts: RecomputeSouvenirProductsUseCase,
  ) {}

  async create(request: UpsertProductRequest): Promise<Product> {
    const input = await this.toInput(request, null);
    const created = await this.products.create(input);
    const withImage = await this.ingestThumbnailIfNeeded(created.id, input);
    const final = withImage ? await this.products.update(created.id, withImage) : created;
    await this.recomputeSouvenirProducts.forProduct(final.id);
    return productToDto(final);
  }

  async update(id: string, request: UpsertProductRequest): Promise<Product> {
    const existing = await this.products.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy sản phẩm id=${id}`);
    const input = await this.toInput(request, existing);
    const withImage = (await this.ingestThumbnailIfNeeded(id, input)) ?? input;
    const updated = await this.products.update(id, withImage);
    await this.recomputeSouvenirProducts.forProduct(id);
    return productToDto(updated);
  }

  /**
   * existing = null khi tao moi. Khi sua, giu nguyen thumbnailSourceUrl cua
   * ban ghi cu neu thumbnailUrl khong doi — tranh bug ghi de mat provenance
   * moi lan sua 1 truong khong lien quan anh (vd doi gia).
   */
  private async toInput(
    request: UpsertProductRequest,
    existing: ProductRecord | null,
  ): Promise<UpsertProductInput> {
    const resolved = await this.resolveLink.execute(request.sourceUrl, null);
    const thumbnailUrl = request.thumbnailUrl?.trim() || null;
    return {
      name: request.name.trim(),
      category: request.category.trim(),
      tags: (request.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0),
      thumbnailUrl,
      thumbnailSourceUrl:
        existing && existing.thumbnailUrl === thumbnailUrl ? existing.thumbnailSourceUrl : null,
      price: request.price ?? null,
      provider: resolved.provider,
      sourceUrl: request.sourceUrl.trim(),
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
    };
  }

  private async ingestThumbnailIfNeeded(
    productId: string,
    input: UpsertProductInput,
  ): Promise<UpsertProductInput | null> {
    if (!isExternalUrl(input.thumbnailUrl)) return null;
    const sourceUrl = input.thumbnailUrl;
    try {
      const paths = await this.ingestImage.execute(
        input.thumbnailUrl!,
        `${productId}/${productId}-thumbnail`,
        PRODUCT_FTP_BASE_DIR_ENV,
      );
      return { ...input, thumbnailUrl: paths.thumb, thumbnailSourceUrl: sourceUrl };
    } catch (err) {
      this.logger.warn(
        `Ingest ảnh đại diện sản phẩm ${productId} thất bại, giữ tạm URL ngoài: ` +
          (err instanceof Error ? err.message : String(err)),
      );
      return { ...input, thumbnailSourceUrl: sourceUrl };
    }
  }
}

/** URL ngoai can ingest — path noi bo (da qua ingest) khong co scheme http(s) */
function isExternalUrl(url: string | null): url is string {
  return !!url && /^https?:\/\//i.test(url);
}
