import { Module } from "@nestjs/common";
import { IMAGE_PROCESSOR } from "./ports/image-processor.port";
import { IMAGE_UPLOADER } from "./ports/image-uploader.port";
import { SharpImageProcessor } from "./infrastructure/sharp-image-processor";
import { FtpsImageUploader } from "./infrastructure/ftps-image-uploader";
import { IngestExternalImageUseCase } from "./application/ingest-external-image.usecase";

/**
 * Pipeline anh dung chung (sharp resize + FTP upload — spec §14.3/§14.5).
 * Dung boi Destination, Hotel, Tour, Product (backlog §B Phase C muc 3) —
 * build 1 lan, moi module chi truyen ten bien env BASE_DIR rieng khi goi
 * ImageUploader.upload(files, baseDirEnvVar).
 */
@Module({
  providers: [
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    { provide: IMAGE_UPLOADER, useClass: FtpsImageUploader },
    IngestExternalImageUseCase,
  ],
  exports: [IMAGE_PROCESSOR, IMAGE_UPLOADER, IngestExternalImageUseCase],
})
export class SharedMediaModule {}
