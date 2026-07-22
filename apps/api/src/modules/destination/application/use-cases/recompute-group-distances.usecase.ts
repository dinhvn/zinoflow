import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RecomputeGroupDistancesReport } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DISTANCE_MATRIX_PROVIDER,
  type DistanceMatrixProvider,
} from "../ports/distance-matrix-provider.port";
import {
  POI_DISTANCE_REPOSITORY,
  type PoiDistancePair,
  type PoiDistanceRepository,
} from "../ports/poi-distance.repository";

/**
 * Tinh khoang cach duong bo that (OpenRouteService) cho 1 cum/tinh —
 * dichoithoi-poi-distance-plan.md Giai doan 2. Goi 1 LAN Matrix API voi
 * locations = [tam cum, ...con co toa do], lay ma tran day du (N+1)x(N+1):
 * hang 0 (tam -> tung con) ghi DistanceFromCenter (cascade mirror + SQL
 * Server); cac hang con lai (con<->con) ghi de TOAN BO poi_distances cua cum
 * nay — full recompute, KHONG incremental (xem plan ly do quyet dinh).
 */
@Injectable()
export class RecomputeGroupDistancesUseCase {
  private readonly logger = new Logger(RecomputeGroupDistancesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(DISTANCE_MATRIX_PROVIDER)
    private readonly distanceMatrix: DistanceMatrixProvider,
    @Inject(POI_DISTANCE_REPOSITORY)
    private readonly poiDistanceRepo: PoiDistanceRepository,
  ) {}

  async execute(parentSlug: string): Promise<RecomputeGroupDistancesReport> {
    const startedAt = Date.now();
    if (!this.distanceMatrix.isConfigured()) {
      throw new DomainRuleError(
        "Chưa cấu hình OPENROUTESERVICE_API_KEY — không tính được khoảng cách đường bộ",
      );
    }

    const all = await this.mirrorRepo.findAll();
    const parent = all.find((d) => d.slug === parentSlug);
    if (!parent) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${parentSlug}"`);
    }
    if (parent.kind !== "province" && parent.kind !== "cluster") {
      throw new DomainRuleError(
        `"${parentSlug}" không phải cụm/tỉnh (kind=${parent.kind}) — chỉ tính khoảng cách cho node cấp cụm/tỉnh`,
      );
    }
    if (parent.lat === null || parent.lng === null) {
      throw new DomainRuleError(`"${parentSlug}" chưa có toạ độ — không tính được khoảng cách`);
    }

    const children = all.filter(
      (d) => d.parentSlug === parentSlug && d.siteStatus === 1 && d.lat !== null && d.lng !== null,
    );
    if (children.length === 0) {
      return { parentSlug, children: 0, pairs: 0, durationMs: Date.now() - startedAt };
    }

    const locations = [
      { lat: Number(parent.lat), lng: Number(parent.lng) },
      ...children.map((c) => ({ lat: Number(c.lat), lng: Number(c.lng) })),
    ];
    const matrix = await this.distanceMatrix.computeMatrix(locations);

    // Hang 0: tam cum -> tung con -> DistanceFromCenter (cascade mirror + SQL Server)
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i]!;
      const distanceMeters = Math.round(matrix[0]![i + 1]!);
      await this.mirrorRepo.setDistanceFromCenter(child.slug, distanceMeters);
      if (child.siteId !== null) {
        await this.siteDb.updateDistanceFromCenter(child.siteId, distanceMeters);
      }
    }

    // Con <-> con: ghi de TOAN BO cap cua cum nay (full recompute)
    const pairs: PoiDistancePair[] = [];
    for (let i = 0; i < children.length; i += 1) {
      for (let j = i + 1; j < children.length; j += 1) {
        const a = children[i]!;
        const b = children[j]!;
        const distanceMeters = Math.round(matrix[i + 1]![j + 1]!);
        const [poiASlug, poiBSlug] = a.slug < b.slug ? [a.slug, b.slug] : [b.slug, a.slug];
        pairs.push({ poiASlug, poiBSlug, distanceMeters });
      }
    }
    await this.poiDistanceRepo.replaceAllForSlugs(
      children.map((c) => c.slug),
      pairs,
    );

    this.logger.log(
      `Tính khoảng cách cụm/tỉnh "${parentSlug}": ${children.length} con, ${pairs.length} cặp`,
    );
    return {
      parentSlug,
      children: children.length,
      pairs: pairs.length,
      durationMs: Date.now() - startedAt,
    };
  }
}
