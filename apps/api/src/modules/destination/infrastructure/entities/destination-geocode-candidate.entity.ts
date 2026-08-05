import { Column, Entity, PrimaryColumn } from "typeorm";
import type {
  DestinationGeocodeCandidateStatus,
  GeocodeCandidateStagedItem,
} from "@zinoflow/contracts";

/**
 * Bang staging cho geocode hang loat qua Google Places API (New)
 * (dichoithoi-destination-geocode-audit-plan.md Giai doan 1b) — PK
 * destination_slug, upsert khi chay lai. CHI luu placeId+confidenceScore
 * vinh vien (dung dieu khoan Google) — xem geocode.ts trong contracts.
 */
@Entity("dichoithoi_destination_geocode_candidates")
export class DestinationGeocodeCandidateEntity {
  @PrimaryColumn({ name: "destination_slug", type: "varchar", length: 64 })
  destinationSlug!: string;

  @Column({ name: "found_at", type: "timestamptz" })
  foundAt!: Date;

  @Column({ type: "jsonb" })
  candidates!: GeocodeCandidateStagedItem[];

  @Column({ type: "varchar", length: 16, default: "pending" })
  status!: DestinationGeocodeCandidateStatus;
}
