import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Tour, UpsertTourRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  TOUR_REPOSITORY,
  type TourRepository,
  type UpsertTourInput,
} from "../ports/tour.repository";
import { TOUR_SITE_DB, type TourSiteDb } from "../ports/tour-site-db.port";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { tourToDto } from "./list-tours.usecase";

/**
 * Tao moi / sua tour — publish THANG xuong SQL Server ngay (tour-spec §2/§4:
 * khong AI, khong quality gate, khong review 2 chot).
 */
@Injectable()
export class UpsertTourUseCase {
  private readonly logger = new Logger(UpsertTourUseCase.name);

  constructor(
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    @Inject(TOUR_SITE_DB) private readonly siteDb: TourSiteDb,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
  ) {}

  async create(request: UpsertTourRequest): Promise<Tour> {
    const input = await this.toInput(request);
    const created = await this.tours.create(input);
    await this.publish(created.id, null, input);
    const withSite = await this.tours.findById(created.id);
    if (!withSite) throw new DomainRuleError("Tour biến mất ngay sau khi tạo");
    return tourToDto(withSite, 0);
  }

  async update(id: string, request: UpsertTourRequest): Promise<Tour> {
    const existing = await this.tours.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy tour id=${id}`);
    const input = await this.toInput(request);
    await this.tours.update(id, input);
    await this.publish(id, existing.siteId, input);
    const updated = await this.tours.findById(id);
    if (!updated) throw new DomainRuleError("Tour biến mất ngay sau khi cập nhật");
    const counts = await this.tours.countDestinationsByTour();
    return tourToDto(updated, counts.get(id) ?? 0);
  }

  private async toInput(request: UpsertTourRequest): Promise<UpsertTourInput> {
    const resolved = await this.resolveLink.execute(request.sourceUrl, request.provider ?? null);
    return {
      name: request.name.trim(),
      shortDescription: request.shortDescription?.trim() || null,
      durationDays: request.durationDays ?? null,
      durationNights: request.durationNights ?? null,
      departureFrom: request.departureFrom?.trim() || null,
      provinceCode: request.provinceCode ?? null,
      priceFrom: request.priceFrom ?? null,
      rating: request.rating ?? null,
      reviewCount: request.reviewCount ?? null,
      thumbnailUrl: request.thumbnailUrl?.trim() || null,
      images: request.images ?? [],
      provider: resolved.provider,
      sourceUrl: request.sourceUrl.trim(),
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
    };
  }

  private async publish(id: string, siteId: number | null, input: UpsertTourInput): Promise<void> {
    const { siteId: newSiteId } = await this.siteDb.upsertTour({
      siteId,
      name: input.name,
      shortDescription: input.shortDescription,
      durationDays: input.durationDays,
      durationNights: input.durationNights,
      departureFrom: input.departureFrom,
      provinceCode: input.provinceCode,
      priceFrom: input.priceFrom,
      rating: input.rating,
      reviewCount: input.reviewCount,
      thumbnailUrl: input.thumbnailUrl,
      imagesJson: JSON.stringify(input.images),
      provider: input.provider,
      sourceUrl: input.sourceUrl,
      affiliateUrl: input.affiliateUrl,
      linkStatus: input.linkStatus,
    });
    if (siteId === null) {
      await this.tours.setSiteId(id, newSiteId);
      this.logger.log(`Publish tour mới "${input.name}" -> siteId ${newSiteId}`);
    }
  }
}
