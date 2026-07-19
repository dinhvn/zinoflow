import { Inject, Injectable, Logger } from "@nestjs/common";
import type { HeroImageMeta } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { CACHE_PURGE, type CachePurgePort } from "../ports/cache-purge.port";

/**
 * Cap nhat mo ta rieng cho Anh dai dien (alt/caption/credit, giong Thu vien
 * anh) — quyet dinh 07/2026, xem dichoithoi-backlog.md muc "SEO ảnh cho
 * gallery hero". Cung mo hinh voi UpdateThumbnailUseCase: luon ghi mirror;
 * neu diem da co siteId thi ghi thang SQL Server luon.
 */
@Injectable()
export class UpdateDestinationHeroImageMetaUseCase {
  private readonly logger = new Logger(UpdateDestinationHeroImageMetaUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(CACHE_PURGE) private readonly cachePurge: CachePurgePort,
  ) {}

  async execute(slug: string, heroImageMeta: HeroImageMeta | null): Promise<void> {
    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    await this.mirrorRepo.setHeroImageMeta(slug, heroImageMeta);
    if (destination.siteId !== null) {
      await this.siteDb.updateHeroImageMeta(
        destination.siteId,
        heroImageMeta ? JSON.stringify(heroImageMeta) : null,
      );
      await this.cachePurge.purgeDestination(slug);
    }
    this.logger.log(`Cập nhật mô tả ảnh đại diện ${slug}`);
  }
}
