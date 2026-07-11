import { Inject, Injectable, Logger } from "@nestjs/common";
import type { ItineraryPlan, UpdateItineraryRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Cap nhat lich trinh goi y cho 1 diem den (content-seo-ux-plan §10.6.2 khoi
 * 3, Phase 28.0). Nhap tay HOAN TOAN — chi co y nghia hien thi voi kind IN
 * (province, cluster) nhung khong rang buoc cung o tang du lieu. Ghi mirror +
 * ghi thang DestinationContent.ItineraryJson neu diem da co bai.
 */
@Injectable()
export class UpdateItineraryUseCase {
  private readonly logger = new Logger(UpdateItineraryUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(slug: string, request: UpdateItineraryRequest): Promise<ItineraryPlan[]> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const itinerary = request.itinerary;
    await this.mirrorRepo.setItinerary(slug, itinerary);
    if (destination.siteId !== null) {
      await this.siteDb.updateItinerary(destination.siteId, JSON.stringify(itinerary));
    }
    this.logger.log(`Cập nhật ${itinerary.length} mẫu lịch trình cho ${slug}`);
    return itinerary;
  }
}
