import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import type { AffiliateReapplyTarget } from "../../../affiliate/application/ports/affiliate-reapply-target.port";
import { AffiliateReapplyRegistry } from "../../../affiliate/application/services/affiliate-reapply-registry.service";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { HOTEL_REPOSITORY, type HotelRepository } from "../ports/hotel.repository";
import { HOTEL_SITE_DB, type HotelSiteDb } from "../ports/hotel-site-db.port";

/** Dang ky vao AffiliateReapplyRegistry (affiliate-link-conversion-spec §4) cho khach san */
@Injectable()
export class HotelAffiliateReapplyService implements AffiliateReapplyTarget, OnModuleInit {
  private readonly logger = new Logger(HotelAffiliateReapplyService.name);
  readonly label = "Khách sạn";

  constructor(
    private readonly registry: AffiliateReapplyRegistry,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(HOTEL_SITE_DB) private readonly siteDb: HotelSiteDb,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async reapply(): Promise<{ updatedCount: number }> {
    const all = await this.hotels.findAll();
    let updatedCount = 0;
    for (const hotel of all) {
      if (hotel.linkStatus === "manual-override") continue;
      const resolved = await this.resolveLink.execute(hotel.sourceUrl, hotel.provider);
      if (resolved.affiliateUrl === hotel.affiliateUrl && resolved.linkStatus === hotel.linkStatus) {
        continue;
      }
      await this.hotels.update(hotel.id, {
        name: hotel.name,
        address: hotel.address,
        lat: hotel.lat,
        lng: hotel.lng,
        provinceCode: hotel.provinceCode,
        priceFrom: hotel.priceFrom,
        rating: hotel.rating,
        reviewCount: hotel.reviewCount,
        thumbnailUrl: hotel.thumbnailUrl,
        images: hotel.images,
        provider: resolved.provider,
        sourceUrl: hotel.sourceUrl,
        affiliateUrl: resolved.affiliateUrl,
        linkStatus: resolved.linkStatus,
      });
      if (hotel.siteId !== null) {
        await this.siteDb.upsertHotel({
          siteId: hotel.siteId,
          name: hotel.name,
          address: hotel.address,
          lat: hotel.lat,
          lng: hotel.lng,
          provinceCode: hotel.provinceCode,
          priceFrom: hotel.priceFrom,
          rating: hotel.rating,
          reviewCount: hotel.reviewCount,
          thumbnailUrl: hotel.thumbnailUrl,
          imagesJson: JSON.stringify(hotel.images),
          provider: resolved.provider,
          sourceUrl: hotel.sourceUrl,
          affiliateUrl: resolved.affiliateUrl,
          linkStatus: resolved.linkStatus,
        });
      }
      updatedCount++;
    }
    this.logger.log(`Ap dung lai affiliate rule: ${updatedCount} khach san doi affiliateUrl`);
    return { updatedCount };
  }
}
