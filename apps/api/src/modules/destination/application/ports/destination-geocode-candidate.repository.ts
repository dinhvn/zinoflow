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
  /** Danh sach dong con "pending"/"not-found" — dung cho bang duyet (ca cho o duyet lan bao khong tim thay) */
  findPending(): Promise<DestinationGeocodeCandidateRecord[]>;
  findBySlug(slug: string): Promise<DestinationGeocodeCandidateRecord | null>;
  /** Danh sach dong da "accepted" — dung cho RefreshWebResultsBatchUseCase (vet lai diem thieu "Ket qua tren web" do bug quet rong truoc 08/08/2026) */
  findAccepted(): Promise<DestinationGeocodeCandidateRecord[]>;
  setStatus(slug: string, status: DestinationGeocodeCandidateStatus): Promise<void>;
  /**
   * Danh sach slug DA TUNG co dong staging (bat ke status nao — pending/
   * not-found/accepted/rejected) — dung de loai khoi lan chay batch sau, tranh
   * quet lai cai da biet ket qua (yeu cau nguoi dung 06/08/2026).
   */
  findAllAttemptedSlugs(): Promise<string[]>;
}
