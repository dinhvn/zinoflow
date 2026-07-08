import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AffiliateModule } from "../affiliate/affiliate.module";
import { ProductsController } from "./presentation/products.controller";
import { ListProductsUseCase } from "./application/use-cases/list-products.usecase";
import { UpsertProductUseCase } from "./application/use-cases/upsert-product.usecase";
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
  imports: [AffiliateModule, TypeOrmModule.forFeature([ProductEntity])],
  controllers: [ProductsController],
  providers: [
    ListProductsUseCase,
    UpsertProductUseCase,
    ListProductCategoriesUseCase,
    { provide: PRODUCT_REPOSITORY, useClass: TypeOrmProductRepository },
  ],
  exports: [PRODUCT_REPOSITORY],
})
export class ProductModule {}
