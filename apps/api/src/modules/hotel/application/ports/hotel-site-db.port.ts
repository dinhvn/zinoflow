export const HOTEL_SITE_DB = Symbol("HOTEL_SITE_DB");

export interface PublishHotelInput {
  siteId: number | null;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  provinceCode: string | null;
  priceFrom: number | null;
  rating: number | null;
  reviewCount: number | null;
  thumbnailUrl: string | null;
  imagesJson: string;
  provider: string | null;
  sourceUrl: string;
  affiliateUrl: string | null;
  linkStatus: string;
}

/**
 * Adapter SQL Server cho v2.Hotel/v2.HotelDestinationMap (hotel-spec §4).
 * Publish khong qua 2 chot duyet — ghi thang khi tao/sua (spec §2).
 */
export interface HotelSiteDb {
  isConfigured(): boolean;
  /** Insert (siteId=null) hoac update (siteId co gia tri) — tra ve siteId */
  upsertHotel(input: PublishHotelInput): Promise<{ siteId: number }>;
  /** Gan/go khach san khoi 1 diem den — resolve DestinationId tu slug */
  assignToDestination(
    hotelSiteId: number,
    destinationSlug: string,
    distanceM: number | null,
    isManual: boolean,
  ): Promise<void>;
  unassignFromDestination(hotelSiteId: number, destinationSlug: string): Promise<void>;
}
