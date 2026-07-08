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
}
