import { Inject, Injectable, Logger } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Content-freshness-plan.md Giai doan D — nut "Đã kiểm tra, vẫn đúng" trong CMS.
 * Bien tap vien xac nhan thu cong da ra lai gia ve/gio mo cua... du KHONG sua chu
 * nao — ghi LastVerifiedAt = now(). KHONG dung ContentUpdatedAt (chi bump khi noi
 * dung THUC SU doi, xem PublishDestinationUseCase) — 2 moc tach biet, badge doc
 * ca 2 nhung chi ContentUpdatedAt moi do vao dateModified/lastmod cho Google.
 */
@Injectable()
export class VerifyContentStillAccurateUseCase {
  private readonly logger = new Logger(VerifyContentStillAccurateUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(slug: string): Promise<void> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    if (destination.siteId === null) {
      throw new DomainRuleError(`Điểm đến "${destination.name}" chưa publish, chưa có gì để xác nhận`);
    }
    await this.siteDb.markContentVerified(destination.siteId);
    this.logger.log(`Xác nhận nội dung vẫn đúng cho ${slug}`);
  }
}
