import { Inject, Injectable } from "@nestjs/common";
import { PRODUCT_REPOSITORY, type ProductRepository } from "../ports/product.repository";

/**
 * Goi y category da dung (autocomplete form quan ly) — tu do nhap, KHONG bang
 * quan ly rieng (chot 07/2026, product-spec §8 #5).
 */
@Injectable()
export class ListProductCategoriesUseCase {
  constructor(@Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository) {}

  execute(): Promise<string[]> {
    return this.products.listDistinctCategories();
  }
}
