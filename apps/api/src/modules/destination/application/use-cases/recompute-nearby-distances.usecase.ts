import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RecomputeNearbyDistancesReport } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  DISTANCE_MATRIX_PROVIDER,
  type DistanceMatrixProvider,
} from "../ports/distance-matrix-provider.port";
import {
  POI_DISTANCE_REPOSITORY,
  type PoiDistancePair,
  type PoiDistanceRepository,
} from "../ports/poi-distance.repository";
import { RecomputeRelatedService } from "../services/recompute-related.service";
import { computeNearby, type RelatedCandidate } from "../../domain/related-builder";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Tinh khoang cach duong bo that tu 1 diem toi cac diem GAN theo ban kinh vat ly
 * (KHONG gioi han cung cha — khac RecomputeGroupDistancesUseCase) —
 * dichoithoi-poi-distance-plan.md Giai doan 3. Dung computeNearby() (Haversine,
 * 30km, top 10) loc ung vien truoc de gioi han quy mo goi ORS, ghi UPSERT vao
 * poi_distances (KHONG xoa cap khac cua diem nay), roi TU GOI
 * RecomputeRelatedService.recomputeFor([slug]) de RelatedJson cua diem nay duoc
 * lam moi ngay — 1 nut bam xong ca 2 viec.
 */
@Injectable()
export class RecomputeNearbyDistancesUseCase {
  private readonly logger = new Logger(RecomputeNearbyDistancesUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DISTANCE_MATRIX_PROVIDER)
    private readonly distanceMatrix: DistanceMatrixProvider,
    @Inject(POI_DISTANCE_REPOSITORY)
    private readonly poiDistanceRepo: PoiDistanceRepository,
    private readonly recomputeRelated: RecomputeRelatedService,
  ) {}

  async execute(slug: string): Promise<RecomputeNearbyDistancesReport> {
    const startedAt = Date.now();
    if (!this.distanceMatrix.isConfigured()) {
      throw new DomainRuleError(
        "Chưa cấu hình OPENROUTESERVICE_API_KEY — không tính được khoảng cách đường bộ",
      );
    }

    const all = await this.mirrorRepo.findAll();
    const self = all.find((d) => d.slug === slug);
    if (!self) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}"`);
    }
    if (self.lat === null || self.lng === null) {
      throw new DomainRuleError(`"${slug}" chưa có toạ độ — không tính được khoảng cách`);
    }

    const candidates = all.map(toCandidate);
    const selfCandidate = candidates.find((c) => c.slug === slug)!;
    const nearby = computeNearby(selfCandidate, candidates);
    if (nearby.length === 0) {
      return { slug, candidates: 0, relatedUpdated: false, durationMs: Date.now() - startedAt };
    }

    const bySlug = new Map(all.map((d) => [d.slug, d]));
    const locations = [
      { lat: Number(self.lat), lng: Number(self.lng) },
      ...nearby.map((n) => {
        const c = bySlug.get(n.slug)!;
        return { lat: Number(c.lat), lng: Number(c.lng) };
      }),
    ];
    const matrix = await this.distanceMatrix.computeMatrix(locations);

    const pairs: PoiDistancePair[] = nearby.map((n, i) => {
      const distanceMeters = Math.round(matrix[0]![i + 1]!);
      const [poiASlug, poiBSlug] = slug < n.slug ? [slug, n.slug] : [n.slug, slug];
      return { poiASlug, poiBSlug, distanceMeters };
    });
    await this.poiDistanceRepo.upsertPairs(pairs);

    const { updated } = await this.recomputeRelated.recomputeFor([slug]);

    this.logger.log(
      `Tính khoảng cách gần đó cho "${slug}": ${nearby.length} ứng viên, RelatedJson ${
        updated > 0 ? "có" : "không"
      } đổi`,
    );
    return {
      slug,
      candidates: nearby.length,
      relatedUpdated: updated > 0,
      durationMs: Date.now() - startedAt,
    };
  }
}

function toCandidate(d: DestinationMirrorEntity): RelatedCandidate {
  return {
    slug: d.slug,
    name: d.name,
    thumbnail: d.thumbnail,
    kind: d.kind as RelatedCandidate["kind"],
    parentSlug: d.parentSlug,
    provinceCode: d.provinceCode,
    lat: d.lat === null ? null : Number(d.lat),
    lng: d.lng === null ? null : Number(d.lng),
    siteStatus: d.siteStatus,
    priority: d.priority,
    order: d.order,
    distanceFromCenter: d.distanceFromCenter === null ? null : Number(d.distanceFromCenter),
    types: d.types,
    tags: d.tags,
    contentTier: d.contentTier,
  };
}
