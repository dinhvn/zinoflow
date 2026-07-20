import { Inject, Injectable, Logger } from "@nestjs/common";
import type { GalleryItem } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { CACHE_PURGE, type CachePurgePort } from "../ports/cache-purge.port";
import { IMAGE_PROCESSOR, type ImageProcessor } from "../../../shared/media/ports/image-processor.port";
import { IMAGE_UPLOADER, type ImageUploader } from "../../../shared/media/ports/image-uploader.port";
import { buildGalleryJson } from "../services/gallery-json.util";
import { slugifyVietnamese } from "../../../shared/text/vietnamese";

/** Chan upload loop tran dung luong FTP (khong co trong spec goc, gioi han an toan). */
const MAX_GALLERY_IMAGES = 30;

/**
 * Them 1 anh vao thu vien anh cua 1 diem den (khac anh dai dien — 1 diem co the
 * co nhieu anh thu vien). Convert 3 co WebP (hero/medium/thumb, giong toWebpVariants
 * dung cho anh dai dien — cho phep website dung srcset responsive, SEO ảnh gallery
 * #5, 07/2026) -> FTP vao {slug}/gallery/ -> append vao mang gallery cua mirror ->
 * ghi thang SQL Server GalleryJson neu diem da co bai (khong cho Publish).
 *
 * `path` luu la BASE NAME (KHONG co duoi .webp) — website tu ghep hau to
 * "-hero/-medium/-thumb.webp" luc render (dung lam co phan biet anh CU: path anh
 * cu tu truoc 07/2026 luon co san duoi .webp, chi 1 file, khong co 3 bien the —
 * xem GalleryItemModel.HasSizeVariants ben repo dichoithoi).
 *
 * alt text KHONG con de trong mac dinh (SEO ảnh gallery #1, 07/2026) — tu goi y
 * "{ten diem den} - ảnh {so thu tu}" (moi anh 1 so thu tu khac nhau nen khong con
 * trung nhau nhu truoc), nguoi dung van sua duoc binh thuong o editor sau upload.
 * Ten file (#4) cung slug hoa tu chinh goi y nay — mang tu khoa thay vi timestamp
 * tran, tai dung slugifyVietnamese() da co san (khong viet slugify moi).
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
    @Inject(CACHE_PURGE) private readonly cachePurge: CachePurgePort,
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

    const ordinal = destination.gallery.length + 1;
    const suggestedAlt = `${destination.name} - ảnh ${ordinal}`;
    // Hau to ngan chong trung ten file giua nhieu anh cung goi y alt (vd nguoi dung
    // xoa bot anh giua roi upload them — ordinal co the trung lai).
    const uniqueSuffix = Date.now().toString().slice(-6);
    const basePath = `${slug}/gallery/${slugifyVietnamese(suggestedAlt)}-${uniqueSuffix}`;

    const variants = await this.processor.toWebpVariants(source);
    await this.uploader.upload([
      { path: `${basePath}-hero.webp`, body: variants.hero, contentType: "image/webp" },
      { path: `${basePath}-medium.webp`, body: variants.medium, contentType: "image/webp" },
      { path: `${basePath}-thumb.webp`, body: variants.thumb, contentType: "image/webp" },
    ]);

    const gallery: GalleryItem[] = [
      ...destination.gallery,
      { path: basePath, altText: suggestedAlt, caption: null, credit: null },
    ];
    await this.mirrorRepo.setGallery(slug, gallery);
    if (destination.siteId !== null) {
      await this.siteDb.updateGallery(destination.siteId, buildGalleryJson(gallery));
      await this.cachePurge.purgeDestination(slug);
    }

    this.logger.log(`Thêm ảnh thư viện ${slug} -> ${basePath} (${gallery.length} ảnh)`);
    return gallery;
  }
}
