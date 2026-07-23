import { Inject, Injectable } from "@nestjs/common";
import type { CreateDestinationTagRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Tao 1 tag moi (destination-spec §2.4) — truoc day tag chi seed duoc qua SQL
 * tay (`phase-b-01-seed-tags.sql`), khong co UI. Kiem tra trung slug truoc de
 * bao loi ro rang bang tieng Viet thay vi de UNIQUE constraint SQL Server nem
 * loi mo qua nhieu vong retry mang cua adapter.
 */
@Injectable()
export class CreateDestinationTagUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(request: CreateDestinationTagRequest): Promise<{ ok: true }> {
    const existing = await this.siteDb.fetchTags();
    if (existing.some((t) => t.slug === request.slug)) {
      throw new DomainRuleError(`Slug "${request.slug}" đã được dùng cho 1 chủ đề khác`);
    }
    await this.siteDb.createTag({
      slug: request.slug,
      name: request.name,
      description: request.description ?? null,
    });
    return { ok: true };
  }
}
