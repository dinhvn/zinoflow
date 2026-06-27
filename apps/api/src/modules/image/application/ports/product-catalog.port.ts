import type { ProductSearchQuery, ProductSearchResult } from "@zinoflow/contracts";

/**
 * Port lay san pham tu CMS cu (spec §12). Application chi biet interface nay,
 * khong goi HTTP truc tiep. Implementation: HttpProductCatalogAdapter.
 */
export const PRODUCT_CATALOG = Symbol("PRODUCT_CATALOG");

export interface ProductCatalog {
  search(query: ProductSearchQuery): Promise<ProductSearchResult>;
}
