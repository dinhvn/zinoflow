import type { AffiliateLinkStatus } from "@zinoflow/contracts";

export const TOUR_REPOSITORY = Symbol("TOUR_REPOSITORY");

export interface TourRecord {
  readonly id: string;
  readonly name: string;
  readonly shortDescription: string | null;
  readonly durationDays: number | null;
  readonly durationNights: number | null;
  readonly departureFrom: string | null;
  readonly provinceCode: string | null;
  readonly priceFrom: number | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly thumbnailUrl: string | null;
  readonly images: string[];
  readonly provider: string | null;
  readonly sourceUrl: string;
  readonly affiliateUrl: string | null;
  readonly linkStatus: AffiliateLinkStatus;
  readonly source: number;
  readonly siteId: number | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UpsertTourInput {
  readonly name: string;
  readonly shortDescription: string | null;
  readonly durationDays: number | null;
  readonly durationNights: number | null;
  readonly departureFrom: string | null;
  readonly provinceCode: string | null;
  readonly priceFrom: number | null;
  readonly rating: number | null;
  readonly reviewCount: number | null;
  readonly thumbnailUrl: string | null;
  readonly images: string[];
  readonly provider: string | null;
  readonly sourceUrl: string;
  readonly affiliateUrl: string;
  readonly linkStatus: AffiliateLinkStatus;
}

export interface TourDestinationMapRecord {
  readonly tourId: string;
  readonly destinationSlug: string;
  readonly isPrimary: boolean;
  readonly isManual: boolean;
}

/** Repository bang tours + tour_destination_map (Postgres — nguon su that) */
export interface TourRepository {
  findAll(): Promise<TourRecord[]>;
  findById(id: string): Promise<TourRecord | null>;
  create(input: UpsertTourInput): Promise<TourRecord>;
  update(id: string, input: UpsertTourInput): Promise<TourRecord>;
  setSiteId(id: string, siteId: number): Promise<void>;
  countDestinationsByTour(): Promise<Map<string, number>>;
  assignToDestination(tourId: string, destinationSlug: string, isPrimary: boolean): Promise<void>;
  unassignFromDestination(tourId: string, destinationSlug: string): Promise<void>;
  listForDestination(destinationSlug: string): Promise<TourDestinationMapRecord[]>;
}
