import { Inject, Injectable, Logger } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Content-freshness-plan.md Giai doan C — bien tap vien xac nhan/lat lai ket qua
 * AI phan loai ContentHtml (PublishDestinationUseCase tra ve trong
 * pendingContentClassification, KHONG tu dong ghi gi ca). isMeaningful=true moi
 * ghi ContentUpdatedAt=now(); isMeaningful=false thi khong lam gi (mac dinh AN
 * TOAN la khong claim freshness khi chua chac chan — tranh "date spam").
 */
@Injectable()
export class ConfirmContentUpdateUseCase {
  private readonly logger = new Logger(ConfirmContentUpdateUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(slug: string, isMeaningful: boolean): Promise<void> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    if (destination.siteId === null) {
      throw new DomainRuleError(`Điểm đến "${destination.name}" chưa publish`);
    }
    if (isMeaningful) {
      await this.siteDb.markContentUpdatedNow(destination.siteId);
      this.logger.log(`Xác nhận cập nhật nội dung thật cho ${slug}`);
    } else {
      this.logger.log(`Xác nhận KHÔNG phải cập nhật nội dung thật cho ${slug} — không ghi gì`);
    }
  }
}
