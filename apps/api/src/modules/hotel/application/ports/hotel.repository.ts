import type { AffiliateLinkStatus } from "@zinoflow/contracts";

export const HOTEL_REPOSITORY = Symbol("HOTEL_REPOSITORY");

export interface HotelRecord {
  readonly id: string;
  readonly name: string;
  readonly address: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly provinceCode: string | null;
  readonly priceFrom: number | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailSourceUrl: string | null;
  readonly images: string[];
  readonly imageSourceUrls: string[];
  readonly provider: string | null;
  readonly sourceUrl: string;
  readonly affiliateUrl: string | null;
  readonly linkStatus: AffiliateLinkStatus;
  readonly source: number;
  readonly siteId: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertHotelInput {
  readonly name: string;
  readonly address: string | null;
  readonly lat: number | null;
  readonly lng: number | null;
  readonly provinceCode: string | null;
  readonly priceFrom: number | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailSourceUrl: string | null;
  readonly images: string[];
  readonly imageSourceUrls: string[];
  readonly provider: string | null;
  readonly sourceUrl: string;
  readonly affiliateUrl: string;
  readonly linkStatus: AffiliateLinkStatus;
}

export interface HotelDestinationMapRecord {
  readonly hotelId: string;
  readonly destinationSlug: string;
  readonly distanceM: number | null;
  readonly isManual: boolean;
}

/** Repository bang hotels + hotel_destination_map (Postgres — nguon su that) */
export interface HotelRepository {
  findAll(): Promise<HotelRecord[]>;
  findById(id: string): Promise<HotelRecord | null>;
  create(input: UpsertHotelInput): Promise<HotelRecord>;
  update(id: string, input: UpsertHotelInput): Promise<HotelRecord>;
  setSiteId(id: string, siteId: number): Promise<void>;
  /** So diem den dang gan cho tung khach san (UI danh sach) */
  countDestinationsByHotel(): Promise<Map<string, number>>;
  assignToDestination(hotelId: string, destinationSlug: string): Promise<void>;
  unassignFromDestination(hotelId: string, destinationSlug: string): Promise<void>;
  listForDestination(destinationSlug: string): Promise<HotelDestinationMapRecord[]>;
  /** Toan bo dong gan (tay + tu dong) cua 1 khach san — job auto-assign dung de
   * biet co dong isManual=true nao dang giu cho khach san nay khong (khong bao
   * gio dong den) */
  listAssignmentsForHotel(hotelId: string): Promise<HotelDestinationMapRecord[]>;
  /** Gan tu dong (isManual=false) theo khoang cach — job auto-assign (hotel-spec §5 job 3) */
  autoAssignToDestination(
    hotelId: string,
    destinationSlug: string,
    distanceM: number,
  ): Promise<void>;
  /** Go 1 dong gan tu dong (chi xoa neu isManual=false — an toan, khong dong den dong tay) */
  removeAutoAssignment(hotelId: string, destinationSlug: string): Promise<void>;
}
