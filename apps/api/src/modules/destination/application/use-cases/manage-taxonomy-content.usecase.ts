import { Inject, Injectable, Logger } from "@nestjs/common";
import type { TaxonomyContent, UpdateTaxonomyDescriptionRequest } from "@zinoflow/contracts";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type { LinkTarget } from "../../../shared/text/auto-link";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { buildTaxonomyDescriptionHtml } from "../services/taxonomy-description-autolink.util";

/**
 * Doc/ghi doan gioi thieu (Description) cho group/type/province — trang danh muc
 * /loai, /tinh (Phase 18.2, content-seo-ux-plan §10.3). Ghi thang SQL Server,
 * KHONG qua mirror Postgres — group/type/province khong co dong mirror rieng
 * (khac Destination), day la du lieu chi ton tai o site DB.
 *
 * Auto-link (24/07/2026, mo rong sang Group/Province 07/2026): moi lan Description duoc
 * luu, tu dong sinh lai DescriptionHtml — link toi cac diem den THUC SU xuat hien tren
 * chinh trang danh muc do (Group: moi diem thuoc 1 Type con cua group; Province: diem la
 * con truc tiep cua node tinh, cung dieu kien voi GetProvincePageAsync ben website).
 */
@Injectable()
export class ManageTaxonomyContentUseCase {
  private readonly logger = new Logger(ManageTaxonomyContentUseCase.name);

  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async getContent(): Promise<TaxonomyContent> {
    if (!this.siteDb.isConfigured()) {
      throw new UpstreamApiError(
        "Chưa cấu hình kết nối database dichoithoi (DICHOITHOI_DB_* trong .env)",
      );
    }
    return this.siteDb.fetchTaxonomyContent();
  }

  async updateDescription(request: UpdateTaxonomyDescriptionRequest): Promise<{ ok: true }> {
    const targets = await this.fetchAutoLinkTargets(request.target, request.id);
    const descriptionHtml = buildTaxonomyDescriptionHtml(request.description, targets);

    await this.siteDb.updateTaxonomyDescription(
      request.target,
      request.id,
      request.description,
      request.metaDescription,
      descriptionHtml,
    );
    this.logger.log(`Cap nhat Description cho ${request.target} id=${request.id}`);
    return { ok: true };
  }

  private fetchAutoLinkTargets(
    target: "group" | "type" | "province",
    id: number,
  ): Promise<readonly LinkTarget[]> {
    if (target === "type") return this.siteDb.fetchDestinationsForType(id);
    if (target === "group") return this.siteDb.fetchDestinationsForGroup(id);
    return this.siteDb.fetchDestinationsForProvince(id);
  }
}
