import { Inject, Injectable, Logger } from "@nestjs/common";
import type { GalleryItem } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../../../shared/media/ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../../../shared/media/ports/image-uploader.port";
import { buildGalleryJson } from "../services/gallery-json.util";

/** Chieu rong 1 anh thu vien — du net cho ca card cuon ngang lan slide hero. */
const GALLERY_IMAGE_WIDTH = 1400;
/** Chan upload loop tran dung luong FTP (khong co trong spec goc, gioi han an toan). */
const MAX_GALLERY_IMAGES = 30;

/**
 * Them 1 anh vao thu vien anh cua 1 diem den (khac anh dai diem — 1 diem co the
 * co nhieu anh thu vien). Resize 1 co WebP -> FTP vao {slug}/gallery/ -> append
 * vao mang gallery cua mirror -> ghi thang SQL Server GalleryJson neu diem da
 * co bai (khong cho Publish). alt/caption/credit de trong, nguoi dung tu dien
 * o editor sau khi upload.
 */
@Injectable()
export class AddDestinationGalleryImageUseCase {
  private readonly logger = new Logger(AddDestinationGalleryImageUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(IMAGE_PROCESSOR) private readonly processor: ImageProcessor,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
  ) {}

  async execute(slug: string, source: Buffer): Promise<GalleryItem[]> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`, [
        "Tạo điểm đến trước khi upload ảnh",
      ]);
    }
    if (destination.gallery.length >= MAX_GALLERY_IMAGES) {
      throw new DomainRuleError(
        `Điểm đến "${destination.name}" đã đủ ${MAX_GALLERY_IMAGES} ảnh thư viện`,
        ["Xoá bớt ảnh cũ trước khi thêm ảnh mới"],
      );
    }

    const resized = await this.processor.toWebp(source, GALLERY_IMAGE_WIDTH);
    const path = `${slug}/gallery/${slug}-${Date.now()}.webp`;
    await this.uploader.upload([{ path, body: resized, contentType: "image/webp" }]);

    const gallery: GalleryItem[] = [
      ...destination.gallery,
      { path, altText: null, caption: null, credit: null },
    ];
    await this.mirrorRepo.setGallery(slug, gallery);
    if (destination.siteId !== null) {
      await this.siteDb.updateGallery(destination.siteId, buildGalleryJson(gallery));
    }

    this.logger.log(`Thêm ảnh thư viện ${slug} -> ${path} (${gallery.length} ảnh)`);
    return gallery;
  }
}
