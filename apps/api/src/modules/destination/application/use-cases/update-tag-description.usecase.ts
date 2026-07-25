import { Inject, Injectable } from "@nestjs/common";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { buildTaxonomyDescriptionHtml } from "../services/taxonomy-description-autolink.util";

/**
 * Luu mo ta tag sau khi nguoi dung duyet ban AI goi y (hoac sua tay) — buoc 3 §2.4.
 * Auto-link (24/07/2026): moi lan luu, tu dong sinh lai DescriptionHtml (link toi cac
 * diem den DA GAN cho chinh tag nay) — ghi rieng cot DescriptionHtml, KHONG dong cham
 * Description goc (nguon sach, CMS textarea luon hien ban plain).
 */
@Injectable()
export class UpdateTagDescriptionUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(
    tagSlug: string,
    description: string | null,
    metaDescription: string | null,
  ): Promise<{ ok: true }> {
    const targets = await this.siteDb.fetchDestinationsForTag(tagSlug);
    const descriptionHtml = buildTaxonomyDescriptionHtml(description, targets);
    await this.siteDb.updateTagDescription(tagSlug, description, metaDescription, descriptionHtml);
    return { ok: true };
  }
}
