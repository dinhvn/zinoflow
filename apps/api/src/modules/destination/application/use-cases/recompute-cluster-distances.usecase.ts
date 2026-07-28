import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RecomputeClusterDistancesReport } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  CLUSTER_DISTANCE_REPOSITORY,
  type ClusterDistancePair,
  type ClusterDistanceRepository,
} from "../ports/cluster-distance.repository";
import {
  DISTANCE_MATRIX_PROVIDER,
  type DistanceMatrixProvider,
} from "../ports/distance-matrix-provider.port";

/**
 * Tinh lai bang dichoithoi_cluster_distances — khoang cach DUONG BO THAT (ORS)
 * giua toa do trung tam moi cap CUM (kind=cluster) co lat/lng (relations-plan
 * §1.2, Giai doan A2; nang cap len ORS o dichoithoi-poi-distance-plan.md Giai
 * doan 5, 23/07/2026 — truoc day dung Haversine, thay bang ORS de dong bo voi
 * poi_distances/DistanceFromCenter da nang cap tu Giai doan 1-3). CHI tinh
 * cum<->cum, KHONG tinh tinh<->tinh (nguoi dung xac nhan 27/07/2026 khong can
 * — toa do trung tam tinh khong du chinh xac de co gia tri thuc te). Chi chay
 * thu cong (nut "Cong cu"/API), KHONG nam trong job recompute-related thuong
 * xuyen — toa do trung tam cac node nay hiem khi doi. Quy mo nho (thuong
 * ~20-30 node, xem audit trong plan doc) nen 1 lan goi ORS Matrix la du,
 * khong can chia block.
 */
@Injectable()
export class RecomputeClusterDistancesUseCase {
  private readonly logger = new Logger(RecomputeClusterDistancesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(CLUSTER_DISTANCE_REPOSITORY)
    private readonly clusterDistanceRepo: ClusterDistanceRepository,
    @Inject(DISTANCE_MATRIX_PROVIDER)
    private readonly distanceMatrix: DistanceMatrixProvider,
  ) {}

  async execute(): Promise<RecomputeClusterDistancesReport> {
    const startedAt = Date.now();
    if (!this.distanceMatrix.isConfigured()) {
      throw new DomainRuleError(
        "Chưa cấu hình OPENROUTESERVICE_API_KEY — không tính được khoảng cách đường bộ",
      );
    }

    const all = await this.mirrorRepo.findAll();
    const nodes = all
      .filter((d) => d.kind === "cluster" && d.lat !== null && d.lng !== null)
      .map((d) => ({ slug: d.slug, lat: Number(d.lat), lng: Number(d.lng) }))
      .sort((a, b) => a.slug.localeCompare(b.slug));

    if (nodes.length < 2) {
      await this.clusterDistanceRepo.replaceAll([]);
      this.logger.log(`Tính lại khoảng cách giữa các cụm: ${nodes.length} node, 0 cặp`);
      return { nodes: nodes.length, pairs: 0, failedPairs: 0, durationMs: Date.now() - startedAt };
    }

    const matrix = await this.distanceMatrix.computeMatrix(
      nodes.map((n) => ({ lat: n.lat, lng: n.lng })),
    );

    // ORS co the tra null cho 1 cap khong tim duoc tuyen duong bo (vd toa do
    // sai/khong noi duong) — BO QUA cap do (KHONG ghi 0, se sai lech nghiem
    // trong: "0m" bi hieu la 2 diem trung nhau) thay vi ep kieu am tham, log ro
    // tung cap loi de nguoi dung tu kiem tra toa do (dichoithoi-poi-distance-plan.md
    // Giai doan 5, phat hien thuc te 23/07/2026: node co toa do khong hop le se
    // khien MOI cap lien quan tra null, khong chi 1 cap don le).
    const pairs: ClusterDistancePair[] = [];
    const failedPairs: string[] = [];
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const a = nodes[i]!;
        const b = nodes[j]!;
        const raw = matrix[i]![j];
        if (typeof raw !== "number" || !Number.isFinite(raw)) {
          failedPairs.push(`${a.slug}<->${b.slug}`);
          continue;
        }
        pairs.push({
          clusterASlug: a.slug,
          clusterBSlug: b.slug,
          distanceMeters: Math.round(raw),
        });
      }
    }

    await this.clusterDistanceRepo.replaceAll(pairs);

    if (failedPairs.length > 0) {
      this.logger.warn(
        `${failedPairs.length} cặp KHÔNG có khoảng cách đường bộ (ORS trả null — kiểm tra lại toạ độ): ` +
          failedPairs.join(", "),
      );
    }
    this.logger.log(`Tính lại khoảng cách giữa các cụm: ${nodes.length} node, ${pairs.length} cặp`);
    return {
      nodes: nodes.length,
      pairs: pairs.length,
      failedPairs: failedPairs.length,
      durationMs: Date.now() - startedAt,
    };
  }
}
