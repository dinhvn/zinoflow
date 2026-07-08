import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Hotel, UpsertHotelRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  HOTEL_REPOSITORY,
  type HotelRepository,
  type UpsertHotelInput,
} from "../ports/hotel.repository";
import { HOTEL_SITE_DB, type HotelSiteDb } from "../ports/hotel-site-db.port";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { hotelToDto } from "./list-hotels.usecase";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";

/**
 * Tao moi / sua khach san — publish THANG xuong SQL Server ngay (hotel-spec §2/§4:
 * khong AI, khong quality gate, khong review 2 chot). affiliateUrl tinh qua
 * AffiliateLinkResolver luc luu (ghi dat, doc re).
 */
@Injectable()
export class UpsertHotelUseCase {
  private readonly logger = new Logger(UpsertHotelUseCase.name);

  constructor(
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(HOTEL_SITE_DB) private readonly siteDb: HotelSiteDb,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly recomputeCards: RecomputeHotelCardsUseCase,
  ) {}

  async create(request: UpsertHotelRequest): Promise<Hotel> {
    const input = await this.toInput(request);
    const created = await this.hotels.create(input);
    await this.publish(created.id, null, input);
    const withSite = await this.hotels.findById(created.id);
    if (!withSite) throw new DomainRuleError("Khách sạn biến mất ngay sau khi tạo");
    return hotelToDto(withSite, 0);
  }

  async update(id: string, request: UpsertHotelRequest): Promise<Hotel> {
    const existing = await this.hotels.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy khách sạn id=${id}`);
    const input = await this.toInput(request);
    await this.hotels.update(id, input);
    await this.publish(id, existing.siteId, input);
    const updated = await this.hotels.findById(id);
    if (!updated) throw new DomainRuleError("Khách sạn biến mất ngay sau khi cập nhật");
    // Gia/rating doi -> mọi diem den dang gan hotel nay can tinh lai HotelCardsJson
    // (chieu nguoc — khac han recompute khi publish destination, Phase 15)
    if (updated.siteId !== null) {
      await this.recomputeCards.forHotel(updated.siteId);
    }
    const counts = await this.hotels.countDestinationsByHotel();
    return hotelToDto(updated, counts.get(id) ?? 0);
  }

  private async toInput(request: UpsertHotelRequest): Promise<UpsertHotelInput> {
    const resolved = await this.resolveLink.execute(request.sourceUrl, request.provider ?? null);
    return {
      name: request.name.trim(),
      address: request.address?.trim() || null,
      lat: request.lat ?? null,
      lng: request.lng ?? null,
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

  private async publish(
    id: string,
    siteId: number | null,
    input: UpsertHotelInput,
  ): Promise<void> {
    const { siteId: newSiteId } = await this.siteDb.upsertHotel({
      siteId,
      name: input.name,
      address: input.address,
      lat: input.lat,
      lng: input.lng,
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
      await this.hotels.setSiteId(id, newSiteId);
      this.logger.log(`Publish khách sạn mới "${input.name}" -> siteId ${newSiteId}`);
    }
  }
}
