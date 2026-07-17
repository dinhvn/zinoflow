import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SharedMediaModule } from "../shared/media/shared-media.module";
import { AiContentModule } from "../ai-content/ai-content.module";
import { ContentImagesController } from "./presentation/content-images.controller";
import { ListContentImagesUseCase } from "./application/use-cases/list-content-images.usecase";
import { UploadContentImageUseCase } from "./application/use-cases/upload-content-image.usecase";
import { UpdateContentImageUseCase } from "./application/use-cases/update-content-image.usecase";
import { DeleteContentImageUseCase } from "./application/use-cases/delete-content-image.usecase";
import { ScanArticlesMissingImagesUseCase } from "./application/use-cases/scan-articles-missing-images.usecase";
import { AutoSearchContentImagesUseCase } from "./application/use-cases/auto-search-content-images.usecase";
import { ApproveContentImageUseCase } from "./application/use-cases/approve-content-image.usecase";
import { RejectContentImageUseCase } from "./application/use-cases/reject-content-image.usecase";
import { CONTENT_IMAGE_REPOSITORY } from "./application/ports/content-image.repository";
import { STOCK_IMAGE_SEARCH } from "./application/ports/stock-image-search.port";
import { TypeOrmContentImageRepository } from "./infrastructure/repositories/typeorm-content-image.repository";
import { PexelsStockImageSearchAdapter } from "./infrastructure/pexels-stock-image-search.adapter";
import { ContentImageEntity } from "./infrastructure/entities/content-image.entity";

/**
 * Module Thu vien anh noi dung (dichoithoi-content-image-library-plan.md Muc A) +
 * tu dong tim anh (dichoithoi-auto-image-search-plan.md) — Postgres-only, doc
 * lap khoi anh diem den. Dung chung SharedMediaModule (IMAGE_UPLOADER/
 * IMAGE_PROCESSOR) — khong tao token DI rieng (quyet dinh §3.1). AiContentModule
 * can cho CONTENT_JOB_REPOSITORY/CONTENT_DRAFT_REPOSITORY (quet bai thieu anh).
 */
@Module({
  imports: [SharedMediaModule, AiContentModule, TypeOrmModule.forFeature([ContentImageEntity])],
  controllers: [ContentImagesController],
  providers: [
    ListContentImagesUseCase,
    UploadContentImageUseCase,
    UpdateContentImageUseCase,
    DeleteContentImageUseCase,
    ScanArticlesMissingImagesUseCase,
    AutoSearchContentImagesUseCase,
    ApproveContentImageUseCase,
    RejectContentImageUseCase,
    { provide: CONTENT_IMAGE_REPOSITORY, useClass: TypeOrmContentImageRepository },
    { provide: STOCK_IMAGE_SEARCH, useClass: PexelsStockImageSearchAdapter },
  ],
  exports: [CONTENT_IMAGE_REPOSITORY],
})
export class ContentImageModule {}
