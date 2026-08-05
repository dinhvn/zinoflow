import { Inject, Injectable } from "@nestjs/common";
import type {
  AuditDestinationDuplicatesClusterFitReport,
  AuditDestinationDuplicatesClusterFitRequest,
} from "@zinoflow/contracts";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";
import { haversineMeters } from "../../domain/related-builder";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Giai doan 2 (dichoithoi-destination-geocode-audit-plan.md) — CHI la bao
 * cao doc (KHONG ghi gi, KHONG bang staging) vi nguong khoang cach CHUA
 * duoc chot (quyet dinh 05/08/2026: "de xem tinh hinh du lieu that truoc").
 * Nguoi dung tu chinh nguong qua query param, xem ket qua, roi tu sua tay
 * qua form sua diem den co san (doi parentSlug / xoa diem trung) — chua xay
 * co che Chap nhan hang loat cho toi khi nguong duoc kiem chung tren du
 * lieu that.
 */
@Injectable()
export class AuditDestinationDuplicatesClusterFitUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(
    request: AuditDestinationDuplicatesClusterFitRequest,
  ): Promise<AuditDestinationDuplicatesClusterFitReport> {
    const all = await this.mirrorRepo.findAll();
    const poiWithCoords = all.filter(
      (d) => d.kind === "poi" && d.lat !== null && d.lng !== null,
    );
    const clusters = all.filter(
      (d) => (d.kind === "cluster" || d.kind === "province") && d.lat !== null && d.lng !== null,
    );

    return {
      duplicatePairs: findDuplicatePairs(poiWithCoords, request.duplicateThresholdMeters),
      misclusteredPoints: findMisclusteredPoints(poiWithCoords, clusters, request.clusterFitRatio),
      totalPoiChecked: poiWithCoords.length,
      totalPoiSkippedNoCoords: all.filter((d) => d.kind === "poi").length - poiWithCoords.length,
    };
  }
}

function coords(d: DestinationMirrorEntity): { lat: number; lng: number } {
  return { lat: Number(d.lat), lng: Number(d.lng) };
}

/** So cap TRONG CUNG 1 cum cha (parentSlug) — quy mo nho nen O(n^2) trong tung cum la du re */
function findDuplicatePairs(
  poi: DestinationMirrorEntity[],
  thresholdMeters: number,
): AuditDestinationDuplicatesClusterFitReport["duplicatePairs"] {
  const byParent = new Map<string, DestinationMirrorEntity[]>();
  for (const d of poi) {
    if (!d.parentSlug) continue;
    const list = byParent.get(d.parentSlug) ?? [];
    list.push(d);
    byParent.set(d.parentSlug, list);
  }

  const pairs: AuditDestinationDuplicatesClusterFitReport["duplicatePairs"] = [];
  for (const [clusterSlug, group] of byParent) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const a = group[i]!;
        const b = group[j]!;
        const ca = coords(a);
        const cb = coords(b);
        const distanceMeters = haversineMeters(ca.lat, ca.lng, cb.lat, cb.lng);
        if (distanceMeters > thresholdMeters) continue;
        pairs.push({
          clusterSlug,
          slugA: a.slug,
          nameA: a.name,
          slugB: b.slug,
          nameB: b.name,
          distanceMeters,
          nameSimilarity: nameSimilarity(a.name, b.name),
        });
      }
    }
  }
  return pairs.sort((x, y) => x.distanceMeters - y.distanceMeters);
}

/**
 * Cho MOI poi, so khoang cach toi cum cha hien tai vs cum GAN NHAT khac
 * (trong toan bo clusters/provinces co toa do) — flag neu cum khac gan hon
 * dang ke (< currentDistance * clusterFitRatio).
 */
function findMisclusteredPoints(
  poi: DestinationMirrorEntity[],
  clusters: DestinationMirrorEntity[],
  clusterFitRatio: number,
): AuditDestinationDuplicatesClusterFitReport["misclusteredPoints"] {
  const clusterCoordsBySlug = new Map(clusters.map((c) => [c.slug, coords(c)]));
  const result: AuditDestinationDuplicatesClusterFitReport["misclusteredPoints"] = [];

  for (const p of poi) {
    if (!p.parentSlug) continue;
    const currentParentCoords = clusterCoordsBySlug.get(p.parentSlug);
    if (!currentParentCoords) continue;
    const pc = coords(p);
    const currentDistanceMeters = haversineMeters(pc.lat, pc.lng, currentParentCoords.lat, currentParentCoords.lng);

    let bestOther: { slug: string; name: string; distanceMeters: number } | null = null;
    for (const c of clusters) {
      if (c.slug === p.parentSlug) continue;
      const cc = coords(c);
      const d = haversineMeters(pc.lat, pc.lng, cc.lat, cc.lng);
      if (!bestOther || d < bestOther.distanceMeters) {
        bestOther = { slug: c.slug, name: c.name, distanceMeters: d };
      }
    }
    if (!bestOther) continue;
    if (bestOther.distanceMeters < currentDistanceMeters * clusterFitRatio) {
      result.push({
        slug: p.slug,
        name: p.name,
        currentParentSlug: p.parentSlug,
        currentDistanceMeters,
        suggestedParentSlug: bestOther.slug,
        suggestedParentName: bestOther.name,
        suggestedDistanceMeters: bestOther.distanceMeters,
      });
    }
  }
  return result.sort((a, b) => a.suggestedDistanceMeters - b.suggestedDistanceMeters);
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeVietnamese(a);
  const nb = normalizeVietnamese(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
