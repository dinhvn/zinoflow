import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DESTINATION_MIRROR_REPOSITORY,
  DESTINATION_RELATION_REPOSITORY,
  type DestinationMirrorRepository,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  buildRelatedItems,
  computeNearby,
  type RelatedCandidate,
} from "../../domain/related-builder";
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

  private async run(
    all: DestinationMirrorEntity[],
    slugs: readonly string[],
  ): Promise<{ scanned: number; updated: number }> {
    const candidates = all.map(toCandidate);
    const bySlug = new Map(candidates.map((c) => [c.slug, c]));
    const siteIdBySlug = new Map(
      all.filter((d) => d.siteId !== null).map((d) => [d.slug, d.siteId!]),
    );

    let scanned = 0;
    let updated = 0;
    for (const slug of slugs) {
      const self = bySlug.get(slug);
      const siteId = siteIdBySlug.get(slug);
      // Chi diem published va da co tren site moi co RelatedJson de ghi
      if (!self || self.siteStatus !== 1 || siteId === undefined) continue;
      scanned += 1;

      const curated = await this.relationRepo.findCuratedRelated(slug);
      const items = buildRelatedItems({
        self,
        all: candidates,
        curatedRelatedSlugs: curated.map((r) => r.targetSlug),
        nearby: computeNearby(self, candidates),
      });
      const changed = await this.siteDb.updateRelatedJson(siteId, JSON.stringify(items));
      if (changed) updated += 1;
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
  };
}
