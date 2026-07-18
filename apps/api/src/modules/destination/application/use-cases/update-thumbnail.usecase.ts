import { Inject, Injectable, Logger } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { CACHE_PURGE, type CachePurgePort } from "../ports/cache-purge.port";

/**
 * Cap nhat duong dan thumbnail cho 1 diem den (spec §14.3 — MVP).
 * Luon ghi mirror; neu diem da ton tai tren site (co siteId) thi ghi thang
 * SQL Server luon — thumbnail la metadata thuan, khong can cho publish bai.
 */
@Injectable()
export class UpdateThumbnailUseCase {
  private readonly logger = new Logger(UpdateThumbnailUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(CACHE_PURGE) private readonly cachePurge: CachePurgePort,
  ) {}

  async execute(slug: string, thumbnail: string | null): Promise<void> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const value = thumbnail?.trim() ? thumbnail.trim() : null;
    await this.mirrorRepo.setThumbnail(slug, value);
    if (destination.siteId !== null) {
      await this.siteDb.updateThumbnail(destination.siteId, value);
      await this.cachePurge.purgeDestination(slug);
    }
    this.logger.log(`Cap nhat thumbnail diem den ${slug}: ${value ?? "(xoa)"}`);
  }
}
