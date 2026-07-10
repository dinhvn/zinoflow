import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RelinkAllReport } from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  DESTINATION_RELATION_REPOSITORY,
  type DestinationMirrorRepository,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  autoLinkContent,
  normalizeDestinationLinks,
  type LinkTarget,
} from "../../../shared/text/auto-link";

/**
 * Re-link toan bo (spec §12.2): bai CU nhac toi diem den MOI thi chua co link —
 * quet ContentHtml moi bai published, chen link con thieu + chuan hoa link theo
 * SlugRedirect. dryRun=true tra bao cao "se sua gi" ma KHONG ghi (xem truoc ->
 * xac nhan -> chay that). Idempotent: bai da co link toi diem nao thi bo qua diem do.
 */
@Injectable()
export class RelinkAllUseCase {
  private readonly logger = new Logger(RelinkAllUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DESTINATION_RELATION_REPOSITORY)
    private readonly relationRepo: DestinationRelationRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(dryRun: boolean): Promise<RelinkAllReport> {
    const startedAt = Date.now();
    const [all, redirects, contentRows] = await Promise.all([
      this.mirrorRepo.findAll(),
      this.siteDb.fetchSlugRedirects(),
      this.siteDb.fetchAllContentRows(),
    ]);

    const published = all.filter((d) => d.siteStatus === 1 && d.siteId !== null);
    const targets: LinkTarget[] = published.map((d) => ({ slug: d.slug, name: d.name }));
    const siteIdBySlug = new Map(published.map((d) => [d.slug, d.siteId!]));

    const details: RelinkAllReport["details"] = [];
    let linksAdded = 0;
    let linksNormalized = 0;

    for (const row of contentRows) {
      if (!row.contentHtml.trim()) continue;

      // Buoc 4 truoc buoc 2-3: chuan hoa slug cu de check idempotent khop slug moi
      const normalizedResult = normalizeDestinationLinks(row.contentHtml, redirects);
      const linkResult = autoLinkContent(normalizedResult.html, targets, row.slug);

      const changed =
        linkResult.addedLinks.length > 0 || normalizedResult.normalized.length > 0;
      if (!changed) continue;

      details.push({
        slug: row.slug,
        addedLinks: linkResult.addedLinks,
        normalizedLinks: normalizedResult.normalized,
      });
      linksAdded += linkResult.addedLinks.length;
      linksNormalized += normalizedResult.normalized.length;

      if (!dryRun) {
        await this.siteDb.updateContentHtml(row.siteId, linkResult.html);
        const targetSiteIds = linkResult.addedLinks
          .map((l) => siteIdBySlug.get(l.targetSlug))
          .filter((id): id is number => id !== undefined);
        await this.siteDb.addMentionedRelations(row.siteId, targetSiteIds);
        // Nguon su that quan he ben Postgres di cung (spec §3.7)
        await this.relationRepo.addMentioned(
          row.slug,
          linkResult.addedLinks.map((l) => l.targetSlug),
        );
      }
    }

    const report: RelinkAllReport = {
      dryRun,
      scanned: contentRows.length,
      changed: details.length,
      linksAdded,
      linksNormalized,
      details,
      durationMs: Date.now() - startedAt,
    };
    this.logger.log(
      `Re-link ${dryRun ? "(xem truoc)" : "(da ghi)"}: quet ${report.scanned}, sua ${report.changed}, them ${linksAdded} link, chuan hoa ${linksNormalized}`,
    );
    return report;
  }
}
