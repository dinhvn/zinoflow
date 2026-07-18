import { Inject, Injectable, Logger } from "@nestjs/common";
import type { GalleryItem, UpdateDestinationGalleryRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { CACHE_PURGE, type CachePurgePort } from "../ports/cache-purge.port";
import { buildGalleryJson } from "../services/gallery-json.util";
import { IMAGE_UPLOADER, type ImageUploader } from "../../../shared/media/ports/image-uploader.port";

/**
 * Ghi de nguyen mang thu vien anh cho 1 diem den — dung khi sua alt/caption/
 * credit, doi thu tu (index mang), hoac xoa anh (khong dung cho THEM anh moi,
 * xem AddDestinationGalleryImageUseCase). Ghi mirror + ghi thang SQL Server neu
 * diem da co bai, KHONG cho Publish moi hien. Anh nao bi loai khoi mang so voi
 * ban ghi cu se bi xoa vat ly luon (best-effort, khong chan viec luu neu xoa
 * file loi — nguoi dung yeu cau 17/07/2026).
 */
@Injectable()
export class UpdateDestinationGalleryUseCase {
  private readonly logger = new Logger(UpdateDestinationGalleryUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(IMAGE_UPLOADER) private readonly uploader: ImageUploader,
    @Inject(CACHE_PURGE) private readonly cachePurge: CachePurgePort,
  ) {}

  async execute(
    slug: string,
    request: UpdateDestinationGalleryRequest,
  ): Promise<GalleryItem[]> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const gallery = request.gallery;
    const keptPaths = new Set(gallery.map((g) => g.path));
    const removedPaths = destination.gallery.filter((g) => !keptPaths.has(g.path)).map((g) => g.path);

    await this.mirrorRepo.setGallery(slug, gallery);
    if (destination.siteId !== null) {
      await this.siteDb.updateGallery(destination.siteId, buildGalleryJson(gallery));
      await this.cachePurge.purgeDestination(slug);
    }
    if (removedPaths.length > 0) {
      await this.uploader.remove(removedPaths);
    }
    this.logger.log(`Cập nhật thư viện ảnh (${gallery.length} ảnh) cho ${slug}`);
    return gallery;
  }
}
