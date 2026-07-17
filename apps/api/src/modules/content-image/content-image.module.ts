import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SharedMediaModule } from "../shared/media/shared-media.module";
import { ContentImagesController } from "./presentation/content-images.controller";
import { ListContentImagesUseCase } from "./application/use-cases/list-content-images.usecase";
import { UploadContentImageUseCase } from "./application/use-cases/upload-content-image.usecase";
import { UpdateContentImageUseCase } from "./application/use-cases/update-content-image.usecase";
import { DeleteContentImageUseCase } from "./application/use-cases/delete-content-image.usecase";
import { CONTENT_IMAGE_REPOSITORY } from "./application/ports/content-image.repository";
import { TypeOrmContentImageRepository } from "./infrastructure/repositories/typeorm-content-image.repository";
import { ContentImageEntity } from "./infrastructure/entities/content-image.entity";

/**
 * Module Thu vien anh noi dung (dichoithoi-content-image-library-plan.md Muc A) —
 * Postgres-only, doc lap khoi anh diem den. Dung chung SharedMediaModule
 * (IMAGE_UPLOADER/IMAGE_PROCESSOR) — khong tao token DI rieng (quyet dinh §3.1).
 */
@Module({
  imports: [SharedMediaModule, TypeOrmModule.forFeature([ContentImageEntity])],
  controllers: [ContentImagesController],
  providers: [
    ListContentImagesUseCase,
    UploadContentImageUseCase,
    UpdateContentImageUseCase,
    DeleteContentImageUseCase,
    { provide: CONTENT_IMAGE_REPOSITORY, useClass: TypeOrmContentImageRepository },
  ],
  exports: [CONTENT_IMAGE_REPOSITORY],
})
export class ContentImageModule {}
