import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { AffiliateReapplyTarget } from "../../../affiliate/application/ports/affiliate-reapply-target.port";
import { AffiliateReapplyRegistry } from "../../../affiliate/application/services/affiliate-reapply-registry.service";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { TOUR_REPOSITORY, type TourRepository } from "../ports/tour.repository";
import { TOUR_SITE_DB, type TourSiteDb } from "../ports/tour-site-db.port";

/** Dang ky vao AffiliateReapplyRegistry (affiliate-link-conversion-spec §4) cho tour */
@Injectable()
export class TourAffiliateReapplyService implements AffiliateReapplyTarget, OnModuleInit {
  private readonly logger = new Logger(TourAffiliateReapplyService.name);
  readonly label = "Tour";

  constructor(
    private readonly registry: AffiliateReapplyRegistry,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    @Inject(TOUR_REPOSITORY) private readonly tours: TourRepository,
    @Inject(TOUR_SITE_DB) private readonly siteDb: TourSiteDb,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async reapply(): Promise<{ updatedCount: number }> {
    const all = await this.tours.findAll();
    let updatedCount = 0;
    for (const tour of all) {
      if (tour.linkStatus === "manual-override") continue;
      const resolved = await this.resolveLink.execute(tour.sourceUrl, tour.provider);
      if (resolved.affiliateUrl === tour.affiliateUrl && resolved.linkStatus === tour.linkStatus) {
        continue;
      }
      await this.tours.update(tour.id, {
        name: tour.name,
        shortDescription: tour.shortDescription,
        durationDays: tour.durationDays,
        durationNights: tour.durationNights,
        departureFrom: tour.departureFrom,
        provinceCode: tour.provinceCode,
        priceFrom: tour.priceFrom,
        rating: tour.rating,
        reviewCount: tour.reviewCount,
        thumbnailUrl: tour.thumbnailUrl,
        thumbnailSourceUrl: tour.thumbnailSourceUrl,
        images: tour.images,
        imageSourceUrls: tour.imageSourceUrls,
        provider: resolved.provider,
        sourceUrl: tour.sourceUrl,
        affiliateUrl: resolved.affiliateUrl,
        linkStatus: resolved.linkStatus,
      });
      if (tour.siteId !== null) {
        await this.siteDb.upsertTour({
          siteId: tour.siteId,
          name: tour.name,
          shortDescription: tour.shortDescription,
          durationDays: tour.durationDays,
          durationNights: tour.durationNights,
          departureFrom: tour.departureFrom,
          provinceCode: tour.provinceCode,
          priceFrom: tour.priceFrom,
          rating: tour.rating,
          reviewCount: tour.reviewCount,
          thumbnailUrl: tour.thumbnailUrl,
          imagesJson: JSON.stringify(tour.images),
          provider: resolved.provider,
          sourceUrl: tour.sourceUrl,
          affiliateUrl: resolved.affiliateUrl,
          linkStatus: resolved.linkStatus,
        });
      }
      updatedCount++;
    }
    this.logger.log(`Ap dung lai affiliate rule: ${updatedCount} tour doi affiliateUrl`);
    return { updatedCount };
  }
}
