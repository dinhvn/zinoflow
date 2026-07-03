import { Inject, Injectable } from "@nestjs/common";
import type { ProductSearchQuery, ProductSearchResult } from "@zinoflow/contracts";
import { PRODUCT_CATALOG, type ProductCatalog } from "../ports/product-catalog.port";

/** Buoc 1: tim san pham tu CMS cu de chon vao working set (spec §3, §12). */
@Injectable()
export class SearchProductsUseCase {
  constructor(@Inject(PRODUCT_CATALOG) private readonly catalog: ProductCatalog) {}

  execute(query: ProductSearchQuery): Promise<ProductSearchResult> {
    return this.catalog.search(query);
  }
}
