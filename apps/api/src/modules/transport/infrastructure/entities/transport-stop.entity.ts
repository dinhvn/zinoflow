import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Bang transport_stops (Postgres) — diem dung tren 1 tuyen: dung DUNG 1 dong
 * role=origin, DUNG 1 dong role=destination, 0..N dong role=waypoint (thu tu
 * seqOrder). Chi role origin/destination duoc hien card tren website, waypoint
 * chi luu lo trinh noi bo (plan §2).
 */
@Entity("transport_stops")
export class TransportStopEntity {
  @PrimaryColumn({ name: "transport_id", type: "uuid" })
  transportId!: string;

  @PrimaryColumn({ name: "destination_slug", type: "varchar", length: 64 })
  destinationSlug!: string;

  /** 1 = origin, 2 = destination, 3 = waypoint */
  @Column({ type: "smallint" })
  role!: number;

  @Column({ name: "seq_order", type: "smallint", default: 0 })
  seqOrder!: number;
}
