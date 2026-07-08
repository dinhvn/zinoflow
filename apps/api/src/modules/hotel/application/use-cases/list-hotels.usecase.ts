import { Inject, Injectable } from "@nestjs/common";
import type { Hotel } from "@zinoflow/contracts";
import {
  HOTEL_REPOSITORY,
  type HotelRecord,
  type HotelRepository,
} from "../ports/hotel.repository";

export function hotelToDto(h: HotelRecord, destinationCount: number): Hotel {
  return {
    id: h.id,
    name: h.name,
    address: h.address,
    lat: h.lat,
    lng: h.lng,
    provinceCode: h.provinceCode,
    priceFrom: h.priceFrom,
    rating: h.rating,
    reviewCount: h.reviewCount,
    thumbnailUrl: h.thumbnailUrl,
    images: h.images,
    provider: h.provider,
    sourceUrl: h.sourceUrl,
    affiliateUrl: h.affiliateUrl,
    linkStatus: h.linkStatus,
    source: h.source,
    siteId: h.siteId,
    destinationCount,
    createdAt: h.createdAt.toISOString(),
    updatedAt: h.updatedAt.toISOString(),
  };
}

/** Danh sach khach san cho man "Khách sạn" (hotel-spec §6) */
@Injectable()
export class ListHotelsUseCase {
  constructor(@Inject(HOTEL_REPOSITORY) private readonly hotels: HotelRepository) {}

  async execute(): Promise<Hotel[]> {
    const [all, counts] = await Promise.all([
      this.hotels.findAll(),
      this.hotels.countDestinationsByHotel(),
    ]);
    return all.map((h) => hotelToDto(h, counts.get(h.id) ?? 0));
  }
}
