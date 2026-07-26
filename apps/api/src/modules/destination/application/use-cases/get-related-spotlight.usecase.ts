import { Inject, Injectable } from "@nestjs/common";
import type { GetRelatedSpotlightResponse } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { RecomputeRelatedService } from "../services/recompute-related.service";

/**
 * Lop "spotlight" tren ban do (relations-plan §5.6, Giai doan C4). Diem DA
 * publish: doc dung RelatedJson THAT da tinh san (Giai doan C2), KHONG tinh
 * lai. Diem CHUA publish (siteId null): khong co gi trong SQL Server de doc —
 * tinh LIVE (khong ghi) qua RecomputeRelatedService.previewFor, cho phep ca
 * ung vien draft (phan hoi nguoi dung 26/07/2026: soan xong toan bo 1 cum roi
 * publish cung luc, can xem truoc quan he giua cac diem draft voi nhau).
 */
@Injectable()
export class GetRelatedSpotlightUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly recomputeRelated: RecomputeRelatedService,
  ) {}

  async execute(slug: string): Promise<GetRelatedSpotlightResponse> {
    const entity = await this.mirrorRepo.findBySlug(slug);
    if (entity && entity.siteId === null) {
      const items = await this.recomputeRelated.previewFor(slug);
      return {
        items: items.map((i) => ({
          slug: i.slug,
          name: i.name,
          badge: i.badge,
          criterion: i.criterion,
          score: i.score,
        })),
        isPreview: true,
      };
    }

    const items = await this.siteDb.fetchRelatedJson(slug);
    return {
      items: items.map((i) => ({ slug: i.slug, name: i.name, badge: i.badge, criterion: i.criterion })),
      isPreview: false,
    };
  }
}
