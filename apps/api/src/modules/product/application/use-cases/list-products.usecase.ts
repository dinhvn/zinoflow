import { Inject, Injectable } from "@nestjs/common";
import type { Product } from "@zinoflow/contracts";
import {
  PRODUCT_REPOSITORY,
  type ProductRecord,
  type ProductRepository,
} from "../ports/product.repository";

export function productToDto(p: ProductRecord): Product {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    tags: p.tags,
    thumbnailUrl: p.thumbnailUrl,
    price: p.price,
    provider: p.provider,
    sourceUrl: p.sourceUrl,
    affiliateUrl: p.affiliateUrl,
    linkStatus: p.linkStatus,
    source: p.source,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

/** Danh sach san pham cho man "Sản phẩm" (product-spec §6) */
@Injectable()
export class ListProductsUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  async execute(): Promise<Product[]> {
    const all = await this.products.findAll();
    return all.map(productToDto);
  }
}
