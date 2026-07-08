import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { AffiliateReapplyTarget } from "../../../affiliate/application/ports/affiliate-reapply-target.port";
import { AffiliateReapplyRegistry } from "../../../affiliate/application/services/affiliate-reapply-registry.service";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Dang ky vao AffiliateReapplyRegistry (spec affiliate-link-conversion §4): khi
 * nguoi dung bam "Áp dụng lại" 1 rule, tinh lai affiliateUrl cho ticketLinks cua
 * MOI diem den (bo qua linkStatus='manual-override'), ghi mirror + site (neu published).
 */
@Injectable()
export class DestinationAffiliateReapplyService implements AffiliateReapplyTarget, OnModuleInit {
  private readonly logger = new Logger(DestinationAffiliateReapplyService.name);
  readonly label = "Vé điểm đến";

  constructor(
    private readonly registry: AffiliateReapplyRegistry,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async reapply(ruleId: string | null): Promise<{ updatedCount: number }> {
    const all = await this.mirrorRepo.findAll();
    let updatedCount = 0;
    for (const destination of all) {
      if (destination.ticketLinks.length === 0) continue;
      let changed = false;
      const recomputed = await Promise.all(
        destination.ticketLinks.map(async (link) => {
          if (link.linkStatus === "manual-override") return link;
          const resolved = await this.resolveLink.execute(link.sourceUrl, link.provider);
          if (resolved.affiliateUrl === link.affiliateUrl && resolved.linkStatus === link.linkStatus) {
            return link;
          }
          changed = true;
          return { ...link, affiliateUrl: resolved.affiliateUrl, linkStatus: resolved.linkStatus };
        }),
      );
      if (!changed) continue;
      await this.mirrorRepo.setTicketLinks(destination.slug, recomputed);
      if (destination.siteId !== null) {
        await this.siteDb.updateTicketLinks(destination.siteId, JSON.stringify(recomputed));
      }
      updatedCount++;
    }
    this.logger.log(
      `Ap dung lai affiliate rule ${ruleId ?? "(toan bo)"}: ${updatedCount} diem den doi ticketLinks`,
    );
    return { updatedCount };
  }
}
