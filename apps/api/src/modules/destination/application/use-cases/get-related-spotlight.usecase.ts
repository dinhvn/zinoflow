import { Inject, Injectable } from "@nestjs/common";
import type { GetRelatedSpotlightResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Lop "spotlight" tren ban do (relations-plan §5.6, Giai doan C4) — doc dung
 * RelatedJson THAT da tinh san (Giai doan C2), KHONG tinh lai. Chi hien khi
 * nguoi dung click 1 diem tren ban do.
 */
@Injectable()
export class GetRelatedSpotlightUseCase {
  constructor(@Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb) {}

  async execute(slug: string): Promise<GetRelatedSpotlightResponse> {
    const items = await this.siteDb.fetchRelatedJson(slug);
    return {
      items: items.map((i) => ({ slug: i.slug, name: i.name, badge: i.badge, criterion: i.criterion })),
    };
  }
}
