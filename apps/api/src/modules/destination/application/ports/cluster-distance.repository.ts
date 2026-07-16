/**
 * Port repository bang `dichoithoi_cluster_distances` (relations-plan §1.2).
 * Implementation: infrastructure/repositories/typeorm-cluster-distance.repository.ts.
 */
export const CLUSTER_DISTANCE_REPOSITORY = Symbol("CLUSTER_DISTANCE_REPOSITORY");

export interface ClusterDistancePair {
  clusterASlug: string;
  clusterBSlug: string;
  distanceMeters: number;
}

export interface ClusterDistanceRepository {
  /** Ghi de TOAN BO bang bang danh sach cap moi tinh duoc (xoa het roi insert lai). */
  replaceAll(pairs: readonly ClusterDistancePair[]): Promise<void>;
  findAll(): Promise<ClusterDistancePair[]>;
}
