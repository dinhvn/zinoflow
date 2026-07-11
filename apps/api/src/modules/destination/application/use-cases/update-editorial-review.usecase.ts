import { Inject, Injectable, Logger } from "@nestjs/common";
import type { UpdateEditorialReviewRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Cap nhat danh gia bien tap cho 1 diem den (nhan dinh ngan cua doi bien tap,
 * KHONG phai AggregateRating — content-seo-ux-plan §10.6.2, Phase 28.0). AI
 * chi goi y qua SuggestEditorialReviewUseCase, endpoint nay CHI ghi ban
 * nguoi dung DA xem/sua.
 */
@Injectable()
export class UpdateEditorialReviewUseCase {
  private readonly logger = new Logger(UpdateEditorialReviewUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(slug: string, request: UpdateEditorialReviewRequest): Promise<string | null> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const editorialReview = request.editorialReview;
    await this.mirrorRepo.setEditorialReview(slug, editorialReview);
    if (destination.siteId !== null) {
      await this.siteDb.updateEditorialReview(destination.siteId, editorialReview);
    }
    this.logger.log(`Cập nhật đánh giá biên tập cho ${slug}`);
    return editorialReview;
  }
}
