import { Inject, Injectable } from "@nestjs/common";
import type { AffiliateLinkItem } from "@zinoflow/contracts";
import {
  DESTINATION_TICKET_REPOSITORY,
  type DestinationTicketRepository,
} from "../ports/destination-ticket.repository";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";

/**
 * Sau moi thay doi 1 dong destination_tickets, gom lai TOAN BO dong cung
 * destination_slug thanh AffiliateLinkItem[] roi ghi vao mirror.ticketLinks
 * (cache) + SQL Server TicketLinksJson (neu diem da publish) — TAI DUNG dung
 * co che sync ticketLinks da co (doc §11.5), khong tao cot/bang SQL Server moi.
 */
@Injectable()
export class SyncDestinationTicketLinksService {
  constructor(
    @Inject(DESTINATION_TICKET_REPOSITORY)
    private readonly tickets: DestinationTicketRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(destinationSlug: string): Promise<void> {
    const rows = await this.tickets.findByDestinationSlug(destinationSlug);
    const ticketLinks: AffiliateLinkItem[] = rows.map((r) => ({
      provider: r.provider,
      label: r.label,
      sourceUrl: r.sourceUrl,
      affiliateUrl: r.affiliateUrl,
      linkStatus: r.linkStatus,
      price: r.price,
    }));
    await this.mirrorRepo.setTicketLinks(destinationSlug, ticketLinks);
    const destination = await this.mirrorRepo.findBySlug(destinationSlug);
    if (destination?.siteId !== null && destination?.siteId !== undefined) {
      await this.siteDb.updateTicketLinks(destination.siteId, JSON.stringify(ticketLinks));
    }
  }
}
