import { Inject, Injectable, Logger } from "@nestjs/common";
import type { GalleryItem, UpdateDestinationGalleryRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { buildGalleryJson } from "../services/gallery-json.util";

/**
 * Ghi de nguyen mang thu vien anh cho 1 diem den — dung khi sua alt/caption/
 * credit, doi thu tu (index mang), hoac xoa anh (khong dung cho THEM anh moi,
 * xem AddDestinationGalleryImageUseCase). Ghi mirror + ghi thang SQL Server neu
 * diem da co bai, KHONG cho Publish moi hien.
 */
@Injectable()
export class UpdateDestinationGalleryUseCase {
  private readonly logger = new Logger(UpdateDestinationGalleryUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
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
    await this.mirrorRepo.setGallery(slug, gallery);
    if (destination.siteId !== null) {
      await this.siteDb.updateGallery(destination.siteId, buildGalleryJson(gallery));
    }
    this.logger.log(`Cập nhật thư viện ảnh (${gallery.length} ảnh) cho ${slug}`);
    return gallery;
  }
}
