import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ExternalReviewUrlItem, UpdateExternalReviewUrlsRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Cap nhat link "Xem thêm trên" (Google Maps/TripAdvisor...) cho 1 diem den
 * (destination-spec §2.2 khoi #10/#15, Phase 28.0). Nhap tay HOAN TOAN, website
 * render rel="nofollow". Ghi mirror + ghi thang DestinationContent neu diem
 * da co bai.
 */
@Injectable()
export class UpdateExternalReviewUrlsUseCase {
  private readonly logger = new Logger(UpdateExternalReviewUrlsUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(
    slug: string,
    request: UpdateExternalReviewUrlsRequest,
  ): Promise<ExternalReviewUrlItem[]> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const externalReviewUrls = request.externalReviewUrls;
    await this.mirrorRepo.setExternalReviewUrls(slug, externalReviewUrls);
    if (destination.siteId !== null) {
      await this.siteDb.updateExternalReviewUrls(
        destination.siteId,
        JSON.stringify(externalReviewUrls),
      );
    }
    this.logger.log(`Cập nhật ${externalReviewUrls.length} link đánh giá ngoài cho ${slug}`);
    return externalReviewUrls;
  }
}
