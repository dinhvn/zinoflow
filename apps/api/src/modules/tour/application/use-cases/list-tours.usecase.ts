import { Inject, Injectable } from "@nestjs/common";
import type { Tour } from "@zinoflow/contracts";
import { TOUR_REPOSITORY, type TourRecord, type TourRepository } from "../ports/tour.repository";

export function tourToDto(t: TourRecord, destinationCount: number): Tour {
  return {
    id: t.id,
    name: t.name,
    shortDescription: t.shortDescription,
    durationDays: t.durationDays,
    durationNights: t.durationNights,
    departureFrom: t.departureFrom,
    provinceCode: t.provinceCode,
    priceFrom: t.priceFrom,
    rating: t.rating,
    reviewCount: t.reviewCount,
    thumbnailUrl: t.thumbnailUrl,
    images: t.images,
    provider: t.provider,
    sourceUrl: t.sourceUrl,
    affiliateUrl: t.affiliateUrl,
    linkStatus: t.linkStatus,
    source: t.source,
    siteId: t.siteId,
    destinationCount,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Danh sach tour cho man "Tour" (tour-spec §6) */
@Injectable()
export class ListToursUseCase {
  constructor(@Inject(TOUR_REPOSITORY) private readonly tours: TourRepository) {}

  async execute(): Promise<Tour[]> {
    const [all, counts] = await Promise.all([
      this.tours.findAll(),
      this.tours.countDestinationsByTour(),
    ]);
    return all.map((t) => tourToDto(t, counts.get(t.id) ?? 0));
  }
}
