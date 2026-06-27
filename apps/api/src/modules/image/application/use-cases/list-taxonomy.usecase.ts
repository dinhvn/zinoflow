import { Inject, Injectable } from "@nestjs/common";
import type { CategoryOption, SupplierOption } from "@zinoflow/contracts";
import { PRODUCT_CATALOG, type ProductCatalog } from "../ports/product-catalog.port";

/** Lay danh sach supplier de loc san pham (spec §12). */
@Injectable()
export class ListSuppliersUseCase {
  constructor(@Inject(PRODUCT_CATALOG) private readonly catalog: ProductCatalog) {}
  execute(): Promise<SupplierOption[]> {
    return this.catalog.listSuppliers();
  }
}

/** Lay danh sach category (phan cap) de loc san pham. */
@Injectable()
export class ListCategoriesUseCase {
  constructor(@Inject(PRODUCT_CATALOG) private readonly catalog: ProductCatalog) {}
  execute(): Promise<CategoryOption[]> {
    return this.catalog.listCategories();
  }
}
