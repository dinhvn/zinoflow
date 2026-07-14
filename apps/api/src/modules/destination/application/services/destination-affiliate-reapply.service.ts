import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Inject } from "@nestjs/common";
import type { AffiliateReapplyTarget } from "../../../affiliate/application/ports/affiliate-reapply-target.port";
import { AffiliateReapplyRegistry } from "../../../affiliate/application/services/affiliate-reapply-registry.service";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import {
  DESTINATION_TICKET_REPOSITORY,
  type DestinationTicketRepository,
} from "../ports/destination-ticket.repository";
import { SyncDestinationTicketLinksService } from "./sync-destination-ticket-links.service";

/**
 * Dang ky vao AffiliateReapplyRegistry: khi nguoi dung bam "Áp dụng lại", tinh
 * lai affiliateUrl cho MOI dong destination_tickets (bo qua linkStatus='manual-
 * override'), roi dong bo lai cache ticketLinks (mirror + site, neu published)
 * cho tung diem den bi anh huong.
 */
@Injectable()
export class DestinationAffiliateReapplyService implements AffiliateReapplyTarget, OnModuleInit {
  private readonly logger = new Logger(DestinationAffiliateReapplyService.name);
  readonly label = "Vé điểm đến";

  constructor(
    private readonly registry: AffiliateReapplyRegistry,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    @Inject(DESTINATION_TICKET_REPOSITORY)
    private readonly tickets: DestinationTicketRepository,
    private readonly syncTicketLinks: SyncDestinationTicketLinksService,
  ) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async reapply(): Promise<{ updatedCount: number }> {
    const all = await this.tickets.findAll();
    const changedSlugs = new Set<string>();
    let updatedCount = 0;
    for (const ticket of all) {
      if (ticket.linkStatus === "manual-override") continue;
      const resolved = await this.resolveLink.execute(ticket.sourceUrl, ticket.provider);
      if (resolved.affiliateUrl === ticket.affiliateUrl && resolved.linkStatus === ticket.linkStatus) {
        continue;
      }
      await this.tickets.update(ticket.id, {
        label: ticket.label,
        provider: resolved.provider,
        sourceUrl: ticket.sourceUrl,
        affiliateUrl: resolved.affiliateUrl,
        linkStatus: resolved.linkStatus,
        price: ticket.price,
        thumbnailUrl: ticket.thumbnailUrl,
        order: ticket.order,
      });
      changedSlugs.add(ticket.destinationSlug);
      updatedCount++;
    }
    for (const slug of changedSlugs) {
      await this.syncTicketLinks.execute(slug);
    }
    this.logger.log(
      `Ap dung lai affiliate rule: ${updatedCount} ve doi affiliateUrl (${changedSlugs.size} diem den)`,
    );
    return { updatedCount };
  }
}
