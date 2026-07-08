import { Inject, Injectable, Logger } from "@nestjs/common";
import type { UploadDestinationImageResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../ports/image-uploader.port";
import { UpdateThumbnailUseCase } from "./update-thumbnail.usecase";

/**
 * Upload anh dai dien cho 1 diem den (spec §14.3 giai doan 2):
 * anh nguon -> 3 co WebP (hero/medium/thumb) -> FTP len contents/diem-den/{slug}/
 * -> ghi path thumb vao cot Thumbnail (mirror + SQL Server neu da co siteId).
 *
 * Ten file giu slug ("{slug}-hero.webp"...) thay vi ten chung — SEO anh dua vao
 * ca filename lan folder, khong chi folder.
 *
 * Path luu la TUONG DOI voi DICHOITHOI_IMAGE_BASE_URL (da tro san toi .../diem-den/),
 * nen path = "{slug}/{slug}-thumb.webp" va FTP BASE_DIR cung tro toi thu muc diem-den do.
 */
@Injectable()
export class UploadDestinationImageUseCase {
  private readonly logger = new Logger(UploadDestinationImageUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
    private readonly updateThumbnail: UpdateThumbnailUseCase,
  ) {}

  async execute(slug: string, source: Buffer): Promise<UploadDestinationImageResponse> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`, [
        "Tạo điểm đến trước khi upload ảnh",
      ]);
    }

    const variants = await this.processor.toWebpVariants(source);
    const paths = {
      hero: `${slug}/${slug}-hero.webp`,
      medium: `${slug}/${slug}-medium.webp`,
      thumb: `${slug}/${slug}-thumb.webp`,
    };

    await this.uploader.upload([
      { path: paths.hero, body: variants.hero, contentType: "image/webp" },
      { path: paths.medium, body: variants.medium, contentType: "image/webp" },
      { path: paths.thumb, body: variants.thumb, contentType: "image/webp" },
    ]);

    // Card danh sach dung co thumb -> ghi vao cot Thumbnail (tai dung logic mirror + SQL)
    await this.updateThumbnail.execute(slug, paths.thumb);

    this.logger.log(`Upload anh dai dien ${slug} xong -> ${paths.thumb}`);
    return { slug, thumbnail: paths.thumb, paths };
  }
}
