import { Inject, Injectable, Logger } from "@nestjs/common";
import type { PriceBreakdownItem, UpdatePriceBreakdownRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Cap nhat gia ve theo doi tuong cho 1 diem den (content-seo-ux-plan §5.5a).
 * Nhap tay HOAN TOAN — khong qua AI, khong qua affiliate resolver (khac
 * ticketLinks[]). Ghi mirror + ghi thang DestinationContent.PriceBreakdownJson
 * neu diem da co bai (khong can publish lai toan bai — giong pattern ticketLinks).
 */
@Injectable()
export class UpdatePriceBreakdownUseCase {
  private readonly logger = new Logger(UpdatePriceBreakdownUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(
    slug: string,
    request: UpdatePriceBreakdownRequest,
  ): Promise<PriceBreakdownItem[]> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const priceBreakdown = request.priceBreakdown;
    await this.mirrorRepo.setPriceBreakdown(slug, priceBreakdown);
    if (destination.siteId !== null) {
      await this.siteDb.updatePriceBreakdown(destination.siteId, JSON.stringify(priceBreakdown));
    }
    this.logger.log(`Cap nhat ${priceBreakdown.length} dong gia ve theo doi tuong cho ${slug}`);
    return priceBreakdown;
  }
}
