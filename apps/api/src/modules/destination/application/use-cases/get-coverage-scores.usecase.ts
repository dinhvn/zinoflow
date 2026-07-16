import { Inject, Injectable } from "@nestjs/common";
import type { ListCoverageScoresResponse } from "@zinoflow/contracts";
import { computeCoverageScore, type CoverageInput } from "../../domain/coverage-score";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Coverage Score (destination-spec §2.2.2) — tinh cho TAT CA diem den da
 * published, sap xep diem thap truoc (uu tien bo sung). Chi doc, khong ghi.
 */
@Injectable()
export class GetCoverageScoresUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY) private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(): Promise<ListCoverageScoresResponse> {
    const [mirrors, coverageRows, tagAssignments, articleCoveredSlugs] = await Promise.all([
      this.mirrorRepo.findAll(),
      this.siteDb.fetchContentCoverageRows(),
      this.siteDb.fetchTagAssignments(),
      this.siteDb.fetchArticleTopicCoverage(),
    ]);

    const published = mirrors.filter((m) => m.siteId !== null && m.siteStatus === 1);
    const coverageById = new Map(coverageRows.map((r) => [r.destinationId, r]));
    const taggedSlugs = new Set(
      tagAssignments.filter((a) => a.tagSlugs.length > 0).map((a) => a.destinationSlug),
    );
    // priority <= 2 = "noi bat" (thay isFeatured cu — relations-plan §1.1, dong bo nguong
    // voi Destination/Detail.cshtml ben dichoithoi).
    const featuredChildBySlug = new Set(
      published.filter((m) => m.priority <= 2 && m.parentSlug).map((m) => m.parentSlug as string),
    );
    const articleCoveredSlugSet = new Set(articleCoveredSlugs);

    const items = published
      .map((m) => {
        const content = coverageById.get(m.siteId as number);
        const input: CoverageInput = {
          kind: m.kind as CoverageInput["kind"],
          contentTier: m.contentTier,
          hasAddress: Boolean(m.addressNew ?? m.addressOld),
          hasCoordinates: m.lat !== null && m.lng !== null,
          hasThumbnail: Boolean(m.thumbnail),
          hasMainContent: content?.hasMainContent ?? false,
          hasOpeningTime: content?.hasOpeningTime ?? false,
          hasTicketPrice: content?.hasTicketPrice ?? false,
          hasFaq: content?.hasFaq ?? false,
          hasPracticalNotes: content?.hasPracticalNotes ?? false,
          hasTicketLinks: content?.hasTicketLinks ?? false,
          hasTag: taggedSlugs.has(m.slug),
          hasFeaturedChild: featuredChildBySlug.has(m.slug),
          hasArticleTopicCoverage: articleCoveredSlugSet.has(m.slug),
          hasEditorialReview: Boolean(m.editorialReview?.trim()),
          hasExternalReviewUrl: m.externalReviewUrls.length > 0,
        };
        const score = computeCoverageScore(input);
        return {
          destinationSlug: m.slug,
          destinationName: m.name,
          kind: m.kind as CoverageInput["kind"],
          tier: score.tier,
          scorePercent: score.scorePercent,
          items: score.items,
        };
      })
      .sort((a, b) => a.scorePercent - b.scorePercent || a.destinationName.localeCompare(b.destinationName, "vi"));

    return { items };
  }
}
