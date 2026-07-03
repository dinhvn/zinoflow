import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ImageController } from "./presentation/image.controller";
import { SearchProductsUseCase } from "./application/use-cases/search-products.usecase";
import { CreateImageJobUseCase } from "./application/use-cases/create-image-job.usecase";
import { GetImageJobUseCase } from "./application/use-cases/get-image-job.usecase";
import { RenderImageJobUseCase } from "./application/use-cases/render-image-job.usecase";
import { ListCategoriesUseCase, ListSuppliersUseCase } from "./application/use-cases/list-taxonomy.usecase";
import { PRODUCT_CATALOG } from "./application/ports/product-catalog.port";
import { IMAGE_RENDERER } from "./application/ports/image-renderer.port";
import { IMAGE_JOB_REPOSITORY } from "./application/ports/image-job.repository";
import { HttpProductCatalogAdapter } from "./infrastructure/cms/http-product-catalog.adapter";
import { RemotionImageRenderer } from "./infrastructure/remotion/remotion-image-renderer.adapter";
import { TypeOrmImageJobRepository } from "./infrastructure/repositories/typeorm-image-job.repository";
import { ImageRenderJobEntity } from "./infrastructure/entities/image-render-job.entity";
import { ImageRenderItemEntity } from "./infrastructure/entities/image-render-item.entity";
import { ImageRenderWorker } from "./infrastructure/workers/image-render.worker";

/**
 * Module Image tool (product collage) — spec docs/specs/image-tool-technical-spec.md.
 * Render qua Remotion (worker pg-boss). Lay san pham tu CMS cu qua adapter.
 */
@Module({
  imports: [TypeOrmModule.forFeature([ImageRenderJobEntity, ImageRenderItemEntity])],
  controllers: [ImageController],
  providers: [
    SearchProductsUseCase,
    CreateImageJobUseCase,
    GetImageJobUseCase,
    RenderImageJobUseCase,
    ListSuppliersUseCase,
    ListCategoriesUseCase,
    ImageRenderWorker,
    { provide: PRODUCT_CATALOG, useClass: HttpProductCatalogAdapter },
    { provide: IMAGE_RENDERER, useClass: RemotionImageRenderer },
    { provide: IMAGE_JOB_REPOSITORY, useClass: TypeOrmImageJobRepository },
  ],
})
export class ImageModule {}
