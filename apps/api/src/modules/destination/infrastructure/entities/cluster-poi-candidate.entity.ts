import { Column, Entity, PrimaryColumn } from "typeorm";
import type { ClusterPoiCandidateItem } from "@zinoflow/contracts";

/**
 * Bang staging cho tinh nang tim diem con (POI) trong 1 cum bang Gemini + Google
 * Search Grounding (dichoithoi-cluster-poi-discovery-plan.md) — PK cluster_slug,
 * upsert khi chay lai, khong giu lich su nhieu phien ban.
 */
@Entity("dichoithoi_cluster_poi_candidates")
export class ClusterPoiCandidateEntity {
  @PrimaryColumn({ name: "cluster_slug", type: "varchar", length: 64 })
  clusterSlug!: string;

  @Column({ name: "extracted_at", type: "timestamptz" })
  extractedAt!: Date;

  @Column({ type: "jsonb" })
  candidates!: ClusterPoiCandidateItem[];
}
