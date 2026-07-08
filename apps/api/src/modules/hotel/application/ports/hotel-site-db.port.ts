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
 * 1 the khach san cho khoi "Khach san goi y" tren trang diem den (Phase 15) —
 * shape KHOP voi HotelCardModel ben website (DestinationExtrasModel.cs), JSON
 * doc-insensitive-case nen dat camelCase o day van map dung sang PascalCase C#.
 */
export interface HotelCardData {
  id: number;
  name: string;
  address: string | null;
  priceFrom: number | null;
  rating: number | null;
  reviewCount: number | null;
  thumbnailUrl: string | null;
  affiliateUrl: string | null;
  sourceUrl: string;
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
  /**
   * Khach san published gan cho 1 diem den, sap theo Rating giam dan, cat
   * `take` dong (Phase 15 — khop dung logic query song cu ben website).
   */
  findCardsForDestination(destinationSlug: string, take: number): Promise<HotelCardData[]>;
  /** Slug moi diem den dang gan khach san nay — cho recompute nguoc khi hotel doi gia/rating */
  findDestinationSlugsForHotel(hotelSiteId: number): Promise<string[]>;
}
