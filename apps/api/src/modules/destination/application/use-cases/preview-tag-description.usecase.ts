import { Inject, Injectable } from "@nestjs/common";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { buildTaxonomyDescriptionHtml } from "../services/taxonomy-description-autolink.util";

/**
 * Xem truoc HTML auto-link cua mo ta tag TRUOC khi luu (nguoi dung yeu cau 25/07/2026,
 * sau khi build xong auto-link cho Tag) — dung dung logic auto-link nhu luc luu that
 * (UpdateTagDescriptionUseCase) nhung khong ghi DB, de CMS hien preview tuc thi tren
 * noi dung dang go trong textarea.
 */
@Injectable()
export class PreviewTagDescriptionUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(tagSlug: string, description: string | null): Promise<{ html: string | null }> {
    const targets = await this.siteDb.fetchDestinationsForTag(tagSlug);
    return { html: buildTaxonomyDescriptionHtml(description, targets) };
  }
}
