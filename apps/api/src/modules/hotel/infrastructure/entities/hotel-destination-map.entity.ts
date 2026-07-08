import { Column, Entity, PrimaryColumn } from "typeorm";

/** Bang hotel_destination_map (Postgres) — khach san nao goi y cho diem den nao (hotel-spec §3) */
@Entity("hotel_destination_map")
export class HotelDestinationMapEntity {
  @PrimaryColumn({ name: "hotel_id", type: "uuid" })
  hotelId!: string;

  @PrimaryColumn({ name: "destination_slug", type: "varchar", length: 64 })
  destinationSlug!: string;

  @Column({ name: "distance_m", type: "int", nullable: true })
  distanceM!: number | null;

  @Column({ name: "is_manual", type: "boolean", default: false })
  isManual!: boolean;
}
