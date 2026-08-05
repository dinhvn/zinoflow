import type {
  DestinationGeocodeCandidateStatus,
  GeocodeCandidateStagedItem,
} from "@zinoflow/contracts";

export const DESTINATION_GEOCODE_CANDIDATE_REPOSITORY = Symbol(
  "DESTINATION_GEOCODE_CANDIDATE_REPOSITORY",
);

export interface DestinationGeocodeCandidateRecord {
  destinationSlug: string;
  foundAt: Date;
  candidates: GeocodeCandidateStagedItem[];
  status: DestinationGeocodeCandidateStatus;
}

export interface DestinationGeocodeCandidateRepository {
  upsert(record: DestinationGeocodeCandidateRecord): Promise<void>;
  /** Danh sach dong con "pending" — dung cho bang duyet */
  findPending(): Promise<DestinationGeocodeCandidateRecord[]>;
  findBySlug(slug: string): Promise<DestinationGeocodeCandidateRecord | null>;
  setStatus(slug: string, status: DestinationGeocodeCandidateStatus): Promise<void>;
}
