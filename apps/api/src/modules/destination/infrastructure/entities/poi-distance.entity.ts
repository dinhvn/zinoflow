import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Khoang cach duong bo that (met) giua 2 diem den con (POI) cung cha hoac gan
 * nhau theo ban kinh — dichoithoi-poi-distance-plan.md. poiASlug < poiBSlug
 * luon (thu tu chuan hoa, tranh luu 2 chieu cho cung 1 cap).
 */
@Entity("dichoithoi_poi_distances")
export class PoiDistanceEntity {
  @PrimaryColumn({ name: "poi_a_slug", type: "varchar", length: 64 })
  poiASlug!: string;

  @PrimaryColumn({ name: "poi_b_slug", type: "varchar", length: 64 })
  poiBSlug!: string;

  @Column({ name: "distance_meters", type: "int" })
  distanceMeters!: number;
}
