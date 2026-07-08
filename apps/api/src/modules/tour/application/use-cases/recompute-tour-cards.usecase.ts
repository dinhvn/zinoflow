import { Inject, Injectable, Logger } from "@nestjs/common";
import { TOUR_SITE_DB, type TourSiteDb } from "../ports/tour-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../../../destination/application/ports/dichoithoi-site-db.port";

/**
 * MUST khop TOUR_CARD_TAKE ben website (DestinationExtrasService.cs) — doi 1
 * trong 2 noi phai doi ca 2 de tranh lech so luong the hien thi.
 */
const TOUR_CARD_TAKE = 6;

/**
 * Tinh lai TourCardsJson cho 1 diem den (Phase 15 — database-redesign §3.4/§4.3).
 * Cung co che voi RecomputeHotelCardsUseCase: `forDestination` khi gan/go tour,
 * `forHotel`→`forTour` quet NGUOC toan bo diem den dang gan khi tour doi gia/rating.
 */
@Injectable()
export class RecomputeTourCardsUseCase {
  private readonly logger = new Logger(RecomputeTourCardsUseCase.name);

  constructor(
    @Inject(TOUR_SITE_DB) private readonly tourSiteDb: TourSiteDb,
    @Inject(DICHOITHOI_SITE_DB) private readonly destinationSiteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinationRepo: DestinationMirrorRepository,
  ) {}

  async forDestination(destinationSlug: string): Promise<void> {
    const destination = await this.destinationRepo.findBySlug(destinationSlug);
    if (!destination || destination.siteId === null) return;
    const cards = await this.tourSiteDb.findCardsForDestination(destinationSlug, TOUR_CARD_TAKE);
    await this.destinationSiteDb.updateTourCards(destination.siteId, JSON.stringify(cards));
  }

  async forTour(tourSiteId: number): Promise<void> {
    const slugs = await this.tourSiteDb.findDestinationSlugsForTour(tourSiteId);
    for (const slug of slugs) {
      await this.forDestination(slug);
    }
    this.logger.log(`Tinh lai TourCardsJson cho ${slugs.length} điểm đến gắn tour ${tourSiteId}`);
  }
}
