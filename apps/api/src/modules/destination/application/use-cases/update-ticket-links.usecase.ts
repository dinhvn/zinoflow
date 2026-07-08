import { Inject, Injectable, Logger } from "@nestjs/common";
import type { AffiliateLinkItem, UpdateTicketLinksRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";

/**
 * Cap nhat danh sach link mua ve cho 1 diem den (affiliate-link-conversion-spec §5).
 * Tinh affiliateUrl qua AffiliateLinkResolver luc luu (ghi dat, doc re) — luon ghi
 * mirror; neu diem da co bai (siteId) thi ghi thang DestinationContent.TicketLinksJson
 * luon, khong can publish lai toan bai (giong pattern updateThumbnail).
 */
@Injectable()
export class UpdateTicketLinksUseCase {
  private readonly logger = new Logger(UpdateTicketLinksUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
  ) {}

  async execute(slug: string, request: UpdateTicketLinksRequest): Promise<AffiliateLinkItem[]> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }

    const ticketLinks: AffiliateLinkItem[] = await Promise.all(
      request.ticketLinks.map(async (link) => {
        const resolved = await this.resolveLink.execute(link.sourceUrl, link.provider);
        return {
          provider: resolved.provider,
          label: link.label ?? null,
          sourceUrl: link.sourceUrl,
          affiliateUrl: resolved.affiliateUrl,
          linkStatus: resolved.linkStatus,
          price: link.price ?? null,
        };
      }),
    );

    await this.mirrorRepo.setTicketLinks(slug, ticketLinks);
    if (destination.siteId !== null) {
      await this.siteDb.updateTicketLinks(destination.siteId, JSON.stringify(ticketLinks));
    }
    this.logger.log(`Cap nhat ${ticketLinks.length} link mua ve cho diem den ${slug}`);
    return ticketLinks;
  }
}
