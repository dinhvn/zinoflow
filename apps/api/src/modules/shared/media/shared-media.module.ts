import { Module } from "@nestjs/common";
import { IMAGE_PROCESSOR } from "./ports/image-processor.port";
import { IMAGE_UPLOADER } from "./ports/image-uploader.port";
import { SharpImageProcessor } from "./infrastructure/sharp-image-processor";
import { FtpsImageUploader } from "./infrastructure/ftps-image-uploader";
import { LocalImageUploader } from "./infrastructure/local-image-uploader";
import { IngestExternalImageUseCase } from "./application/ingest-external-image.usecase";

/**
 * Pipeline anh dung chung (sharp resize + upload — spec §14.3/§14.5).
 * Dung boi Destination, Hotel, Tour, Product (backlog §B Phase C muc 3) —
 * build 1 lan, moi module chi truyen ten bien env BASE_DIR rieng khi goi
 * ImageUploader.upload(files, baseDirEnvVar).
 *
 * IMAGE_UPLOADER_PROVIDER chon adapter: "local" (ghi thang vao repo
 * DiChoiThoi.Web tren may — dev/test) hoac "ftp" (day len site4now production,
 * mac dinh). Tranh goi FTP that ngoai y muon luc dev.
 */
@Module({
  providers: [
    { provide: IMAGE_PROCESSOR, useClass: SharpImageProcessor },
    {
      provide: IMAGE_UPLOADER,
      useClass: process.env.IMAGE_UPLOADER_PROVIDER === "local" ? LocalImageUploader : FtpsImageUploader,
    },
    IngestExternalImageUseCase,
  ],
  exports: [IMAGE_PROCESSOR, IMAGE_UPLOADER, IngestExternalImageUseCase],
})
export class SharedMediaModule {}
