import { Inject, Injectable } from "@nestjs/common";
import type { UpdateDestinationTagRequest } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/** Sua ten/trang thai 1 tag (destination-spec §2.4) — Slug giu nguyen, khong sua duoc. */
@Injectable()
export class UpdateDestinationTagUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(tagSlug: string, request: UpdateDestinationTagRequest): Promise<{ ok: true }> {
    await this.siteDb.updateTag(tagSlug, request);
    return { ok: true };
  }
}
