import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { SharedMediaModule } from "../shared/media/shared-media.module";
import { SharedSheetImportModule } from "../shared/sheet-import/shared-sheet-import.module";
import { ProductsController } from "./presentation/products.controller";
import { ListProductsUseCase } from "./application/use-cases/list-products.usecase";
import { UpsertProductUseCase } from "./application/use-cases/upsert-product.usecase";
import { ImportProductsUseCase } from "./application/use-cases/import-products.usecase";
import { ListProductCategoriesUseCase } from "./application/use-cases/list-product-categories.usecase";
import { PRODUCT_REPOSITORY } from "./application/ports/product.repository";
import { TypeOrmProductRepository } from "./infrastructure/repositories/typeorm-product.repository";
import { ProductEntity } from "./infrastructure/entities/product.entity";

/**
 * Module San pham (M4 Phase 16) — affiliate dung chung, ghep vao bai viet qua
 * tag (product-spec §1). Postgres-only, KHONG dong bo SQL Server, KHONG trang
 * rieng — chi la khoi dong `[[block:products/product...]]` trong bai cam nang.
 */
@Module({
  imports: [
    AffiliateModule,
    SharedMediaModule,
    SharedSheetImportModule,
    TypeOrmModule.forFeature([ProductEntity]),
  ],
  controllers: [ProductsController],
  providers: [
    ListProductsUseCase,
    UpsertProductUseCase,
    ImportProductsUseCase,
    ListProductCategoriesUseCase,
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductModule {}
