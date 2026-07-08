import { Inject, Injectable } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { HOTEL_REPOSITORY, type HotelRepository } from "../ports/hotel.repository";
import { HOTEL_SITE_DB, type HotelSiteDb } from "../ports/hotel-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";

/** Gan/go 1 khach san khoi 1 diem den — gan tay (hotel-spec §3/§6 MVP) */
@Injectable()
export class AssignHotelToDestinationUseCase {
  constructor(
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(HOTEL_SITE_DB) private readonly siteDb: HotelSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinationRepo: DestinationMirrorRepository,
    private readonly recomputeCards: RecomputeHotelCardsUseCase,
  ) {}

  async assign(hotelId: string, destinationSlug: string): Promise<void> {
    const hotel = await this.hotels.findById(hotelId);
    if (!hotel) throw new DomainRuleError(`Không tìm thấy khách sạn id=${hotelId}`);
    if (hotel.siteId === null) {
      throw new DomainRuleError("Khách sạn chưa publish (chưa có siteId) — thử lại sau khi lưu");
    }
    const destination = await this.destinationRepo.findBySlug(destinationSlug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${destinationSlug}"`);
    }
    if (destination.siteId === null) {
      throw new DomainRuleError(
        `Điểm đến "${destinationSlug}" chưa publish trên website — publish bài trước`,
      );
    }
    await this.hotels.assignToDestination(hotelId, destinationSlug);
    await this.siteDb.assignToDestination(hotel.siteId, destinationSlug, null, true);
    await this.recomputeCards.forDestination(destinationSlug);
  }

  async unassign(hotelId: string, destinationSlug: string): Promise<void> {
    const hotel = await this.hotels.findById(hotelId);
    if (!hotel) throw new DomainRuleError(`Không tìm thấy khách sạn id=${hotelId}`);
    await this.hotels.unassignFromDestination(hotelId, destinationSlug);
    if (hotel.siteId !== null) {
      await this.siteDb.unassignFromDestination(hotel.siteId, destinationSlug);
    }
    await this.recomputeCards.forDestination(destinationSlug);
  }
}
