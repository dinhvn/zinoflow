import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RenameDestinationSlugResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { RecomputeRelatedService } from "../services/recompute-related.service";
import { JOB_QUEUE, QUEUE_NAMES, type JobQueue } from "../../../shared/jobs/job-queue.port";

/**
 * Doi slug 1 diem den DA TON TAI (Phase 24 chieu ghi — dichoithoi-implementation-plan.md
 * Phase 24). Thao tac RIENG, tach khoi UpsertDestinationUseCase vi anh huong xa hon 1
 * dong (con chau, hotel/tour map, products.tags, SlugRedirect...) — xem plan thiet ke.
 *
 * THU TU: tinh tap anh huong TRUOC khi doi slug (sau khi doi, oldSlug khong con de tra
 * cuu quan he) -> cascade Postgres -> cascade SQL Server + ghi SlugRedirect (neu da
 * publish) -> recompute AncestorsJson/ChildrenJson/RelatedJson -> enqueue relink (sua
 * href noi bo trong bai khac dang tro slug cu).
 */
@Injectable()
export class RenameDestinationSlugUseCase {
  private readonly logger = new Logger(RenameDestinationSlugUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    private readonly recomputeRelated: RecomputeRelatedService,
    @Inject(JOB_QUEUE) private readonly jobQueue: JobQueue,
  ) {}

  async execute(oldSlug: string, newSlug: string): Promise<RenameDestinationSlugResponse> {
    const existing = await this.mirrorRepo.findBySlug(oldSlug);
    if (!existing) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${oldSlug}"`);
    }
    if (newSlug === oldSlug) {
      throw new DomainRuleError("Slug mới phải khác slug hiện tại");
    }
    if (await this.mirrorRepo.findBySlug(newSlug)) {
      throw new DomainRuleError(`Slug "${newSlug}" đã tồn tại`, [
        "Chọn slug khác chưa được dùng",
      ]);
    }
    if (existing.activeContentJobId !== null) {
      throw new DomainRuleError(
        `Điểm đến "${oldSlug}" đang có bài AI soạn dở — chờ xong/huỷ job trước khi đổi slug`,
      );
    }

    // Tinh TRUOC khi doi — sau khi doi oldSlug khong con ton tai de tra cuu quan he.
    const affected = await this.recomputeRelated.affectedSlugsForRename(oldSlug);

    await this.mirrorRepo.renameSlug(oldSlug, newSlug);

    if (existing.siteId !== null) {
      await this.siteDb.renameSlug(existing.siteId, oldSlug, newSlug);
    }

    const affectedAfterRename = affected.map((s) => (s === oldSlug ? newSlug : s));
    await this.recomputeRelated.recomputeFor(affectedAfterRename);

    // Fire-and-forget: sua href noi bo con tro slug cu trong bai khac (spec §12.2).
    await this.jobQueue.send(QUEUE_NAMES.destinationRelink, {});

    this.logger.log(`Doi slug diem den: ${oldSlug} -> ${newSlug}`);
    return { oldSlug, newSlug };
  }
}
