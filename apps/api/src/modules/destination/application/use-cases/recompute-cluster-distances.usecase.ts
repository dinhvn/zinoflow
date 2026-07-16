import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RecomputeClusterDistancesReport } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  CLUSTER_DISTANCE_REPOSITORY,
  type ClusterDistancePair,
  type ClusterDistanceRepository,
} from "../ports/cluster-distance.repository";
import { haversineMeters } from "../../domain/related-builder";

/**
 * Tinh lai bang dichoithoi_cluster_distances — khoang cach giua toa do trung tam
 * moi cap node cap cao (kind IN province,cluster) co lat/lng (relations-plan §1.2,
 * Giai doan A2). Chi chay thu cong (nut "Cong cu"/API), KHONG nam trong job
 * recompute-related thuong xuyen — toa do trung tam cac node nay hiem khi doi.
 */
@Injectable()
export class RecomputeClusterDistancesUseCase {
  private readonly logger = new Logger(RecomputeClusterDistancesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(CLUSTER_DISTANCE_REPOSITORY)
    private readonly clusterDistanceRepo: ClusterDistanceRepository,
  ) {}

  async execute(): Promise<RecomputeClusterDistancesReport> {
    const startedAt = Date.now();
    const all = await this.mirrorRepo.findAll();
    const nodes = all
      .filter((d) => (d.kind === "province" || d.kind === "cluster") && d.lat !== null && d.lng !== null)
      .map((d) => ({ slug: d.slug, lat: Number(d.lat), lng: Number(d.lng) }))
      .sort((a, b) => a.slug.localeCompare(b.slug));

    const pairs: ClusterDistancePair[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        pairs.push({
          clusterASlug: a.slug,
          clusterBSlug: b.slug,
          distanceMeters: haversineMeters(a.lat, a.lng, b.lat, b.lng),
        });
      }
    }

    await this.clusterDistanceRepo.replaceAll(pairs);

    this.logger.log(`Tính lại khoảng cách cụm/tỉnh: ${nodes.length} node, ${pairs.length} cặp`);
    return { nodes: nodes.length, pairs: pairs.length, durationMs: Date.now() - startedAt };
  }
}
