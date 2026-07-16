import { Column, Entity, PrimaryColumn } from "typeorm";

/**
 * Khoang cach (met) giua toa do trung tam 2 node cap cao (kind IN province,cluster) —
 * dichoithoi-destination-relations-plan.md §1.2. clusterASlug < clusterBSlug luon
 * (thu tu chuan hoa, tranh luu 2 chieu cho cung 1 cap).
 */
@Entity("dichoithoi_cluster_distances")
export class ClusterDistanceEntity {
  @PrimaryColumn({ name: "cluster_a_slug", type: "varchar", length: 64 })
  clusterASlug!: string;

  @PrimaryColumn({ name: "cluster_b_slug", type: "varchar", length: 64 })
  clusterBSlug!: string;

  @Column({ name: "distance_meters", type: "int" })
  distanceMeters!: number;
}
