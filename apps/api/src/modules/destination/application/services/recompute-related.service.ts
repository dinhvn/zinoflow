import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DESTINATION_MIRROR_REPOSITORY,
  DESTINATION_RELATION_REPOSITORY,
  type DestinationMirrorRepository,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { CACHE_PURGE, type CachePurgePort } from "../ports/cache-purge.port";
import {
  CLUSTER_DISTANCE_REPOSITORY,
  type ClusterDistanceRepository,
} from "../ports/cluster-distance.repository";
import {
  POI_DISTANCE_REPOSITORY,
  type PoiDistanceRepository,
} from "../ports/poi-distance.repository";
import {
  buildRelatedItems,
  clusterDistanceKey,
  type RelatedCandidate,
} from "../../domain/related-builder";
import { buildAncestors, buildChildren } from "../../domain/ancestors-children-builder";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Tinh lai RelatedJson (khoi "diem den lien quan" precompute — spec §12.3).
 * Dung o 2 cho: publish (chi cac diem BI ANH HUONG) va nut "Tinh lai toan bo".
 * Chi UPDATE khi JSON doi (adapter so sanh trong SQL) — tranh invalidate cache vo ich.
 */
@Injectable()
export class RecomputeRelatedService {
  private readonly logger = new Logger(RecomputeRelatedService.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DESTINATION_RELATION_REPOSITORY)
    private readonly relationRepo: DestinationRelationRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(CACHE_PURGE) private readonly cachePurge: CachePurgePort,
    @Inject(CLUSTER_DISTANCE_REPOSITORY)
    private readonly clusterDistanceRepo: ClusterDistanceRepository,
    @Inject(POI_DISTANCE_REPOSITORY)
    private readonly poiDistanceRepo: PoiDistanceRepository,
  ) {}

  /** Tinh lai cho danh sach slug cu the. Tra ve so bai co RelatedJson THAY DOI. */
  async recomputeFor(slugs: readonly string[]): Promise<{ scanned: number; updated: number }> {
    const all = await this.mirrorRepo.findAll();
    return this.run(all, [...new Set(slugs)]);
  }

  /** Tinh lai TOAN BO diem published (nut man Cong cu — spec §12.3) */
  async recomputeAll(): Promise<{ scanned: number; updated: number }> {
    const all = await this.mirrorRepo.findAll();
    return this.run(
      all,
      all.filter((d) => d.siteStatus === 1).map((d) => d.slug),
    );
  }

  /**
   * Tap diem BI ANH HUONG khi 1 diem vua publish (spec §12.3): chinh no, cha,
   * anh em cung cha, va moi diem co quan he toi no.
   */
  async affectedSlugsFor(slug: string): Promise<string[]> {
    const all = await this.mirrorRepo.findAll();
    const self = all.find((d) => d.slug === slug);
    if (!self) return [slug];
    const affected = new Set<string>([slug]);
    if (self.parentSlug) affected.add(self.parentSlug);
    for (const d of all) {
      if (self.parentSlug && d.parentSlug === self.parentSlug) affected.add(d.slug);
      if (d.parentSlug === slug) affected.add(d.slug);
    }
    for (const source of await this.relationRepo.findSourcesLinkingTo(slug)) {
      affected.add(source);
    }
    return [...affected];
  }

  /**
   * Tap diem BI ANH HUONG khi doi cha cua 1 diem (Phase 14 — database-redesign
   * §3.4): chinh no + TOAN BO con chau (Ancestors cua tung dua thay doi vi 1 mat
   * xich giua chuoi thay doi) + cha cu + cha moi (Children cua 2 diem nay thay doi).
   */
  async affectedSlugsForParentChange(
    slug: string,
    oldParentSlug: string | null,
    newParentSlug: string | null,
  ): Promise<string[]> {
    const all = await this.mirrorRepo.findAll();
    const affected = new Set<string>([slug]);
    if (oldParentSlug) affected.add(oldParentSlug);
    if (newParentSlug) affected.add(newParentSlug);

    // BFS toan bo con chau cua slug (khong chi con truc tiep)
    const queue = [slug];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const d of all) {
        if (d.parentSlug === current && !affected.has(d.slug)) {
          affected.add(d.slug);
          queue.push(d.slug);
        }
      }
    }
    return [...affected];
  }

  /**
   * Tap diem BI ANH HUONG khi doi SLUG cua 1 diem (Phase 24 chieu ghi —
   * dichoithoi-implementation-plan.md Phase 24): chinh no + TOAN BO con chau
   * (BFS, giong affectedSlugsForParentChange — AncestorsJson cua tung dua
   * nhung con nhac ten cu) + cha (ChildrenJson cua cha nhac ten cu) + moi
   * nguon co quan he/nhac toi slug nay. PHAI goi TRUOC khi doi slug that su
   * (sau khi doi, oldSlug khong con ton tai de tra cuu quan he).
   */
  async affectedSlugsForRename(slug: string): Promise<string[]> {
    const all = await this.mirrorRepo.findAll();
    const self = all.find((d) => d.slug === slug);
    const affected = new Set<string>([slug]);
    if (self?.parentSlug) affected.add(self.parentSlug);

    const queue = [slug];
    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const d of all) {
        if (d.parentSlug === current && !affected.has(d.slug)) {
          affected.add(d.slug);
          queue.push(d.slug);
        }
      }
    }
    for (const source of await this.relationRepo.findSourcesLinkingTo(slug)) {
      affected.add(source);
    }
    return [...affected];
  }

  private async run(
    all: DestinationMirrorEntity[],
    slugs: readonly string[],
  ): Promise<{ scanned: number; updated: number }> {
    const candidates = all.map(toCandidate);
    const bySlug = new Map(candidates.map((c) => [c.slug, c]));
    const siteIdBySlug = new Map(
      all.filter((d) => d.siteId !== null).map((d) => [d.slug, d.siteId!]),
    );
    const clusterDistancePairs = await this.clusterDistanceRepo.findAll();
    const clusterDistances = new Map(
      clusterDistancePairs.map((p) => [
        clusterDistanceKey(p.clusterASlug, p.clusterBSlug),
        p.distanceMeters,
      ]),
    );
    const poiDistancePairs = await this.poiDistanceRepo.findAll();
    const poiDistances = new Map(
      poiDistancePairs.map((p) => [clusterDistanceKey(p.poiASlug, p.poiBSlug), p.distanceMeters]),
    );

    let scanned = 0;
    let updated = 0;
    for (const slug of slugs) {
      const self = bySlug.get(slug);
      const siteId = siteIdBySlug.get(slug);
      // Chi diem published va da co tren site moi co RelatedJson de ghi
      if (!self || self.siteStatus !== 1 || siteId === undefined) continue;
      scanned += 1;

      const [curated, excluded] = await Promise.all([
        this.relationRepo.findCuratedRelated(slug),
        this.relationRepo.findExcluded(slug),
      ]);
      const items = buildRelatedItems({
        self,
        all: candidates,
        curatedRelatedSlugs: curated.map((r) => r.targetSlug),
        clusterDistances,
        poiDistances,
        excludedSlugs: new Set(excluded),
      });
      const relatedChanged = await this.siteDb.updateRelatedJson(siteId, JSON.stringify(items));

      const ancestors = buildAncestors(self, candidates);
      const children = buildChildren(self, candidates);
      const treeChanged = await this.siteDb.updateAncestorsChildren(
        siteId,
        JSON.stringify(ancestors),
        JSON.stringify(children),
      );

      if (relatedChanged || treeChanged) {
        updated += 1;
        // Noi dung trang chi tiet cua slug nay vua doi — purge dung URL do (Phase 17)
        await this.cachePurge.purgeDestination(slug);
      }
    }

    this.logger.log(`Recompute related: ${scanned} bai quet, ${updated} bai cap nhat`);
    return { scanned, updated };
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
    contentTier: d.contentTier,
  };
}
