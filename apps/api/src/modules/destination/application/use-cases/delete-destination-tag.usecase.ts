import { Inject, Injectable } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Xoa 1 tag chua duoc gan cho diem den nao (destination-spec §2.4). Chan xoa
 * neu dang duoc gan — bao loi ro rang thay vi de FK constraint SQL Server nem
 * loi mo qua nhieu vong retry mang cua adapter.
 */
@Injectable()
export class DeleteDestinationTagUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(tagSlug: string): Promise<{ ok: true }> {
    const assignments = await this.siteDb.fetchTagAssignments();
    const usedCount = assignments.filter((a) => a.tagSlugs.includes(tagSlug)).length;
    if (usedCount > 0) {
      throw new DomainRuleError(
        `Chủ đề "${tagSlug}" đang được gán cho ${usedCount} điểm đến — gỡ gán hết trước khi xoá`,
      );
    }
    await this.siteDb.deleteTag(tagSlug);
    return { ok: true };
  }
}
