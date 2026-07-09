import { Inject, Injectable, Logger } from "@nestjs/common";
import type { TaxonomyContent, UpdateTaxonomyDescriptionRequest } from "@zinoflow/contracts";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Doc/ghi doan gioi thieu (Description) cho group/type/province — trang danh muc
 * /loai, /tinh (Phase 18.2, content-seo-ux-plan §10.3). Ghi thang SQL Server,
 * KHONG qua mirror Postgres — group/type/province khong co dong mirror rieng
 * (khac Destination), day la du lieu chi ton tai o site DB.
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
    await this.siteDb.updateTaxonomyDescription(request.target, request.id, request.description);
    this.logger.log(`Cap nhat Description cho ${request.target} id=${request.id}`);
    return { ok: true };
  }
}
