import { Inject, Injectable, Logger } from "@nestjs/common";
import type { UpdateMetaTitleRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Cap nhat metaTitle thu cong cho 1 diem den — cung co che voi
 * BulkUpdateDestinationFieldsUseCase nhung sua tung diem tu trang chi tiet
 * (khong can qua CSV). Ghi thang DestinationContent, KHONG dong cham
 * draftArticle.metadata.metaTitle — publish lai bai AI se ghi de gia tri nay.
 */
@Injectable()
export class UpdateMetaTitleUseCase {
  private readonly logger = new Logger(UpdateMetaTitleUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(slug: string, request: UpdateMetaTitleRequest): Promise<string | null> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const metaTitle = request.metaTitle;
    await this.mirrorRepo.setMetaTitle(slug, metaTitle);
    if (destination.siteId !== null) {
      await this.siteDb.updateMetaTitle(destination.siteId, metaTitle);
    }
    this.logger.log(`Cập nhật meta title cho ${slug}`);
    return metaTitle;
  }
}
