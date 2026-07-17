import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ContentImage } from "@zinoflow/contracts";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../../../shared/media/ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../../../shared/media/ports/image-uploader.port";
import {
  CONTENT_IMAGE_REPOSITORY,
  type ContentImageRepository,
} from "../ports/content-image.repository";
import { toContentImage } from "./to-content-image";

const CONTENT_IMAGE_WIDTH = 1200;
const CONTENT_IMAGE_BASE_DIR_ENV = "DICHOITHOI_FTP_CONTENT_IMAGE_BASE_DIR";

/** Upload 1 anh vao thu vien noi dung (plan §3.1) — doc lap khoi anh diem den */
@Injectable()
export class UploadContentImageUseCase {
  constructor(
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
    @Inject(CONTENT_IMAGE_REPOSITORY) private readonly repo: ContentImageRepository,
  ) {}

  async execute(source: Buffer, altText: string): Promise<ContentImage> {
    const resized = await this.processor.toWebp(source, CONTENT_IMAGE_WIDTH);
    const { width, height } = await this.processor.getDimensions(resized);
    // baseDirEnvVar da tro thang toi thu muc "noi-dung" tren hosting — path chi can ten file
    const path = `${randomUUID()}.webp`;
    await this.uploader.upload(
      [{ path, body: resized, contentType: "image/webp" }],
      CONTENT_IMAGE_BASE_DIR_ENV,
    );
    const record = await this.repo.create({ path, altText, width, height });
    return toContentImage(record);
  }
}
