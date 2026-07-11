import { Inject, Injectable, Logger } from "@nestjs/common";
import { HOTEL_REPOSITORY, type HotelRepository } from "../ports/hotel.repository";
import { HOTEL_SITE_DB, type HotelSiteDb } from "../ports/hotel-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import { haversineMeters, NEARBY_RADIUS_METERS } from "../../../destination/domain/related-builder";
import { RecomputeHotelCardsUseCase } from "./recompute-hotel-cards.usecase";

/**
 * Job (3) hotel-spec §5 — gan tu dong hotel_destination_map theo khoang cach,
 * tai dung haversine da co o Destination (related-builder.ts). Chi tao/xoa
 * dong isManual=false; 1 khach san da co BAT KY dong isManual=true nao thi bo
 * qua hoan toan (da duoc nguoi dung tu curate, khong de job dong vao).
 *
 * Chay qua pg-boss (QUEUE_NAMES.hotelAutoAssign): (a) enqueue tu dong sau khi
 * tao khach san moi co toa do (upsert-hotel.usecase.ts), (b) nut "Tinh lai gan
 * tu dong" o UI khi diem den doi toa do (chua co trigger tu dong chieu nay —
 * xem ghi chu o hotel-auto-assign.worker.ts).
 */
@Injectable()
export class AutoAssignHotelsByDistanceUseCase {
  private readonly logger = new Logger(AutoAssignHotelsByDistanceUseCase.name);

  constructor(
    @Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository,
    @Inject(HOTEL_SITE_DB) private readonly siteDb: HotelSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinationRepo: DestinationMirrorRepository,
    private readonly recomputeCards: RecomputeHotelCardsUseCase,
  ) {}

  async execute(): Promise<{ assigned: number; skippedManual: number; outOfRange: number }> {
    const [allHotels, allDestinations] = await Promise.all([
      this.hotels.findAll(),
      this.destinationRepo.findAll(),
    ]);

    const candidates = allDestinations
      .filter(
        (d) => d.siteStatus === 1 && d.siteId !== null && d.lat !== null && d.lng !== null,
      )
      .map((d) => ({
        slug: d.slug,
        lat: Number(d.lat),
        lng: Number(d.lng),
      }));

    let assigned = 0;
    let skippedManual = 0;
    let outOfRange = 0;
    const affectedSlugs = new Set<string>();

    for (const hotel of allHotels) {
      if (hotel.lat === null || hotel.lng === null || hotel.siteId === null) continue;

      const assignments = await this.hotels.listAssignmentsForHotel(hotel.id);
      if (assignments.some((a) => a.isManual)) {
        skippedManual++;
        continue;
      }

      let nearest: { slug: string; distanceM: number } | null = null;
      for (const c of candidates) {
        const distanceM = haversineMeters(hotel.lat, hotel.lng, c.lat, c.lng);
        if (distanceM > NEARBY_RADIUS_METERS) continue;
        if (!nearest || distanceM < nearest.distanceM) nearest = { slug: c.slug, distanceM };
      }

      const already = assignments.length === 1 ? assignments[0] : null;
      if (nearest && already?.destinationSlug === nearest.slug && already.distanceM === nearest.distanceM) {
        continue; // idempotent — khong doi gi
      }

      for (const old of assignments) {
        affectedSlugs.add(old.destinationSlug);
        await this.hotels.removeAutoAssignment(hotel.id, old.destinationSlug);
        await this.siteDb.unassignFromDestination(hotel.siteId, old.destinationSlug);
      }

      if (nearest) {
        await this.hotels.autoAssignToDestination(hotel.id, nearest.slug, nearest.distanceM);
        await this.siteDb.assignToDestination(hotel.siteId, nearest.slug, nearest.distanceM, false);
        affectedSlugs.add(nearest.slug);
        assigned++;
      } else if (assignments.length > 0) {
        outOfRange++;
      }
    }

    for (const slug of affectedSlugs) {
      await this.recomputeCards.forDestination(slug);
    }

    this.logger.log(
      `Auto-assign hotel theo khoảng cách: ${assigned} gán/cập nhật, ${skippedManual} bỏ qua (đã gán tay), ` +
        `${outOfRange} gỡ (ngoài bán kính ${NEARBY_RADIUS_METERS}m), ${affectedSlugs.size} điểm đến cần recompute`,
    );
    return { assigned, skippedManual, outOfRange };
  }
}
