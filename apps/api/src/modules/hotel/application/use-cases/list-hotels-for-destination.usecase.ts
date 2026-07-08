import { Inject, Injectable } from "@nestjs/common";
import type { Hotel } from "@zinoflow/contracts";
import { HOTEL_REPOSITORY, type HotelRepository } from "../ports/hotel.repository";
import { hotelToDto } from "./list-hotels.usecase";

/** Khach san dang gan cho 1 diem den — panel "Khách sạn gợi ý" (hotel-spec §6) */
@Injectable()
export class ListHotelsForDestinationUseCase {
  constructor(@Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository) {}

  async execute(destinationSlug: string): Promise<Hotel[]> {
    const [maps, all, counts] = await Promise.all([
      this.hotels.listForDestination(destinationSlug),
      this.hotels.findAll(),
      this.hotels.countDestinationsByHotel(),
    ]);
    const byId = new Map(all.map((h) => [h.id, h]));
    return maps
      .map((m) => byId.get(m.hotelId))
      .filter((h): h is NonNullable<typeof h> => h !== undefined)
      .map((h) => hotelToDto(h, counts.get(h.id) ?? 0));
  }
}
