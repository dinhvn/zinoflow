import type {
  CategoryOption,
  ProductSearchQuery,
  ProductSearchResult,
  SupplierOption,
} from "@zinoflow/contracts";

/**
 * Port lay san pham tu CMS cu (spec §12). Application chi biet interface nay,
 * khong goi HTTP truc tiep. Implementation: HttpProductCatalogAdapter.
 */
export const PRODUCT_CATALOG = Symbol("PRODUCT_CATALOG");

export interface ProductCatalog {
  search(query: ProductSearchQuery): Promise<ProductSearchResult>;
  listSuppliers(): Promise<SupplierOption[]>;
  listCategories(): Promise<CategoryOption[]>;
}
