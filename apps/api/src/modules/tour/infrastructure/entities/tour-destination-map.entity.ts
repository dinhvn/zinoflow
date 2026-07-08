import { Column, Entity, PrimaryColumn } from "typeorm";

/** Bang tour_destination_map (Postgres) — 1 tour co the gan NHIEU diem den (tour-spec §3) */
@Entity("tour_destination_map")
export class TourDestinationMapEntity {
  @PrimaryColumn({ name: "tour_id", type: "uuid" })
  tourId!: string;

  @PrimaryColumn({ name: "destination_slug", type: "varchar", length: 64 })
  destinationSlug!: string;

  @Column({ name: "is_primary", type: "boolean", default: false })
  isPrimary!: boolean;

  @Column({ name: "is_manual", type: "boolean", default: false })
  isManual!: boolean;
}
