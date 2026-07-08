import { Inject, Injectable } from "@nestjs/common";
import type { Product, UpsertProductRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
  type UpsertProductInput,
} from "../ports/product.repository";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { productToDto } from "./list-products.usecase";

/**
 * Tao moi / sua san pham — nhap tay, publish THANG (khong AI, khong 2 chot
 * duyet, khong dong bo SQL Server — product-spec §2/§5). affiliateUrl tinh
 * qua AffiliateLinkResolver luc luu, cung co che voi Hotel/Tour/ticketLinks.
 */
@Injectable()
export class UpsertProductUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
  ) {}

  async create(request: UpsertProductRequest): Promise<Product> {
    const input = await this.toInput(request);
    const created = await this.products.create(input);
    return productToDto(created);
  }

  async update(id: string, request: UpsertProductRequest): Promise<Product> {
    const existing = await this.products.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy sản phẩm id=${id}`);
    const input = await this.toInput(request);
    const updated = await this.products.update(id, input);
    return productToDto(updated);
  }

  private async toInput(request: UpsertProductRequest): Promise<UpsertProductInput> {
    const resolved = await this.resolveLink.execute(request.sourceUrl, null);
    return {
      name: request.name.trim(),
      category: request.category.trim(),
      tags: (request.tags ?? []).map((t) => t.trim()).filter((t) => t.length > 0),
      thumbnailUrl: request.thumbnailUrl?.trim() || null,
      price: request.price ?? null,
      provider: resolved.provider,
      sourceUrl: request.sourceUrl.trim(),
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
    };
  }
}
