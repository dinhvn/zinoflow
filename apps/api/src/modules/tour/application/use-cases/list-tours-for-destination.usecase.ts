import { Inject, Injectable } from "@nestjs/common";
import type { Tour } from "@zinoflow/contracts";
import { TOUR_REPOSITORY, type TourRepository } from "../ports/tour.repository";
import { tourToDto } from "./list-tours.usecase";

/** Tour dang gan cho 1 diem den — panel "Tour gợi ý" (tour-spec §6) */
@Injectable()
export class ListToursForDestinationUseCase {
  constructor(@Inject(TOUR_REPOSITORY) private readonly tours: TourRepository) {}

  async execute(destinationSlug: string): Promise<Tour[]> {
    const [maps, all, counts] = await Promise.all([
      this.tours.listForDestination(destinationSlug),
      this.tours.findAll(),
      this.tours.countDestinationsByTour(),
    ]);
    const byId = new Map(all.map((t) => [t.id, t]));
    return maps
      .map((m) => byId.get(m.tourId))
      .filter((t): t is NonNullable<typeof t> => t !== undefined)
      .map((t) => tourToDto(t, counts.get(t.id) ?? 0));
  }
}
