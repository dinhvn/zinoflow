export const TOUR_SITE_DB = Symbol("TOUR_SITE_DB");

export interface PublishTourInput {
  siteId: number | null;
  name: string;
  shortDescription: string | null;
  durationDays: number | null;
  durationNights: number | null;
  departureFrom: string | null;
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
 * 1 the tour cho khoi "Tour goi y" tren trang diem den (Phase 15) — shape KHOP
 * voi TourCardModel ben website (DestinationExtrasModel.cs).
 */
export interface TourCardData {
  id: number;
  name: string;
  shortDescription: string | null;
  durationDays: number | null;
  durationNights: number | null;
  priceFrom: number | null;
  rating: number | null;
  reviewCount: number | null;
  thumbnailUrl: string | null;
  affiliateUrl: string | null;
  sourceUrl: string;
  linkStatus: string;
}

/** Adapter SQL Server cho v2.Tour/v2.TourDestinationMap (tour-spec §4) */
export interface TourSiteDb {
  isConfigured(): boolean;
  upsertTour(input: PublishTourInput): Promise<{ siteId: number }>;
  assignToDestination(
    tourSiteId: number,
    destinationSlug: string,
    isPrimary: boolean,
    isManual: boolean,
  ): Promise<void>;
  unassignFromDestination(tourSiteId: number, destinationSlug: string): Promise<void>;
  /** Tour published gan cho 1 diem den, sap theo Rating giam dan, cat `take` dong (Phase 15) */
  findCardsForDestination(destinationSlug: string, take: number): Promise<TourCardData[]>;
  /** Slug moi diem den dang gan tour nay — cho recompute nguoc khi tour doi gia/rating */
  findDestinationSlugsForTour(tourSiteId: number): Promise<string[]>;
}
