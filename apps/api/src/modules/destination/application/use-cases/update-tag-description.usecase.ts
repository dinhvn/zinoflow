import { Inject, Injectable } from "@nestjs/common";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/** Luu mo ta tag sau khi nguoi dung duyet ban AI goi y (hoac sua tay) — buoc 3 §2.4 */
@Injectable()
export class UpdateTagDescriptionUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(tagSlug: string, description: string | null): Promise<{ ok: true }> {
    await this.siteDb.updateTagDescription(tagSlug, description);
    return { ok: true };
  }
}
