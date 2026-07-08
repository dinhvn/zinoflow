import { Inject, Injectable, Logger } from "@nestjs/common";
import { HOTEL_SITE_DB, type HotelSiteDb } from "../ports/hotel-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../../../destination/application/ports/dichoithoi-site-db.port";

/**
 * MUST khop HOTEL_CARD_TAKE ben website (DestinationExtrasService.cs) — doi 1
 * trong 2 noi phai doi ca 2 de tranh lech so luong the hien thi.
 */
const HOTEL_CARD_TAKE = 6;

/**
 * Tinh lai HotelCardsJson cho 1 diem den (Phase 15 — database-redesign §3.4/§4.3).
 * Thay JOIN+ORDER BY+TAKE song moi lan website render bang 1 cot precompute,
 * ghi lai theo 2 chieu: (a) gan/go khach san khoi diem den — `forDestination`;
 * (b) khach san doi gia/rating (khong dong cham mapping) — `forHotel` quet
 * NGUOC toan bo diem den dang gan khach san nay va tinh lai tung diem.
 */
@Injectable()
export class RecomputeHotelCardsUseCase {
  private readonly logger = new Logger(RecomputeHotelCardsUseCase.name);

  constructor(
    @Inject(HOTEL_SITE_DB) private readonly hotelSiteDb: HotelSiteDb,
    @Inject(DICHOITHOI_SITE_DB) private readonly destinationSiteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinationRepo: DestinationMirrorRepository,
  ) {}

  async forDestination(destinationSlug: string): Promise<void> {
    const destination = await this.destinationRepo.findBySlug(destinationSlug);
    if (!destination || destination.siteId === null) return;
    const cards = await this.hotelSiteDb.findCardsForDestination(
      destinationSlug,
      HOTEL_CARD_TAKE,
    );
    await this.destinationSiteDb.updateHotelCards(destination.siteId, JSON.stringify(cards));
  }

  async forHotel(hotelSiteId: number): Promise<void> {
    const slugs = await this.hotelSiteDb.findDestinationSlugsForHotel(hotelSiteId);
    for (const slug of slugs) {
      await this.forDestination(slug);
    }
    this.logger.log(`Tinh lai HotelCardsJson cho ${slugs.length} điểm đến gắn hotel ${hotelSiteId}`);
  }
}
