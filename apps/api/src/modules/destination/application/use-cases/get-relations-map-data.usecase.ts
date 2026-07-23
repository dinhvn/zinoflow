import { Inject, Injectable } from "@nestjs/common";
import type { GetRelationsMapDataResponse } from "@zinoflow/contracts";
import {
  CLUSTER_DISTANCE_REPOSITORY,
  type ClusterDistanceRepository,
} from "../ports/cluster-distance.repository";
import {
  DESTINATION_RELATION_REPOSITORY,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";
import {
  POI_DISTANCE_REPOSITORY,
  type PoiDistanceRepository,
} from "../ports/poi-distance.repository";

/**
 * Du lieu nen cho lop quan he tren ban do (relations-plan §5.3, Giai doan C4) —
 * khoang cach cum/tinh tu dong tinh (A2) + quan he curated tay (co san hoac
 * vua noi qua C4) + khoang cach con↔con cung cum (dichoithoi-poi-distance-plan.md,
 * dichoithoi-map-cluster-view-plan.md Giai doan D1 — tra ve TOAN BO bang, frontend
 * tu loc theo cum dang xem, dung pattern clusterDistances da lam). Khong dinh
 * nghia dinh (node) — trang ban do da co san qua GET /destinations/map, chi
 * ghep bang slug.
 */
@Injectable()
export class GetRelationsMapDataUseCase {
  constructor(
    @Inject(CLUSTER_DISTANCE_REPOSITORY)
    private readonly clusterDistanceRepo: ClusterDistanceRepository,
    @Inject(DESTINATION_RELATION_REPOSITORY)
    private readonly relationRepo: DestinationRelationRepository,
    @Inject(POI_DISTANCE_REPOSITORY)
    private readonly poiDistanceRepo: PoiDistanceRepository,
  ) {}

  async execute(): Promise<GetRelationsMapDataResponse> {
    const [clusterDistances, curated, poiDistances] = await Promise.all([
      this.clusterDistanceRepo.findAll(),
      this.relationRepo.findAllCuratedRelated(),
      this.poiDistanceRepo.findAll(),
    ]);
    return {
      clusterDistances: clusterDistances.map((p) => ({
        clusterASlug: p.clusterASlug,
        clusterBSlug: p.clusterBSlug,
        distanceMeters: p.distanceMeters,
      })),
      curatedRelations: curated.map((r) => ({ sourceSlug: r.sourceSlug, targetSlug: r.targetSlug })),
      poiDistances: poiDistances.map((p) => ({
        poiASlug: p.poiASlug,
        poiBSlug: p.poiBSlug,
        distanceMeters: p.distanceMeters,
      })),
    };
  }
}
