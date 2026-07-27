import type { ClusterPoiCandidateItem } from "@zinoflow/contracts";

/**
 * Port repository bang staging tim diem con trong cum (dichoithoi-cluster-poi-
 * discovery-plan.md) — PK clusterSlug, upsert khi chay lai.
 * Implementation: infrastructure/repositories/typeorm-cluster-poi-candidate.repository.ts.
 */
export const CLUSTER_POI_CANDIDATE_REPOSITORY = Symbol("CLUSTER_POI_CANDIDATE_REPOSITORY");

export interface ClusterPoiCandidateRecord {
  clusterSlug: string;
  extractedAt: Date;
  candidates: ClusterPoiCandidateItem[];
}

export interface ClusterPoiCandidateRepository {
  findByClusterSlug(clusterSlug: string): Promise<ClusterPoiCandidateRecord | null>;
  /** Ghi de nguyen mang candidates (dung sau khi doi status cac phan tu da Chap nhan) */
  updateCandidates(clusterSlug: string, candidates: ClusterPoiCandidateItem[]): Promise<void>;
  upsert(record: ClusterPoiCandidateRecord): Promise<void>;
}
