import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  DestinationTicketImportRow,
  ImportDestinationTicketsRequest,
  ImportDestinationTicketsResult,
} from "@zinoflow/contracts";
import {
  DESTINATION_TICKET_REPOSITORY,
  type DestinationTicketRepository,
} from "../ports/destination-ticket.repository";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { SyncDestinationTicketLinksService } from "../services/sync-destination-ticket-links.service";

/**
 * Import hàng loạt "Vé tham quan" từ Google Sheet public — khớp theo
 * destinationSlug + sourceUrl (đã có thì cập nhật, chưa có thì tạo mới trong
 * bảng destination_tickets). LƯU THẲNG, không dry-run/preview (cùng pattern
 * import Đối tác affiliate). destinationSlug phải khớp đúng 1 điểm đến đã có
 * trong mirror — không tự tạo điểm đến mới.
 */
@Injectable()
export class ImportDestinationTicketsUseCase {
  private readonly logger = new Logger(ImportDestinationTicketsUseCase.name);

  constructor(
    @Inject(DESTINATION_TICKET_REPOSITORY)
    private readonly tickets: DestinationTicketRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly syncTicketLinks: SyncDestinationTicketLinksService,
  ) {}

  async execute(request: ImportDestinationTicketsRequest): Promise<ImportDestinationTicketsResult> {
    let created = 0;
    let updated = 0;
    const errors: Array<{ row: number; destinationSlug: string; message: string }> = [];
    const affectedSlugs = new Set<string>();
    const orderCounters = new Map<string, number>();

    for (const [index, item] of request.items.entries()) {
      const rowNumber = index + 1;
      try {
        const wasUpdate = await this.importRow(item, orderCounters);
        affectedSlugs.add(item.destinationSlug);
        if (wasUpdate) updated++;
        else created++;
      } catch (err) {
        errors.push({
          row: rowNumber,
          destinationSlug: item.destinationSlug,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    for (const slug of affectedSlugs) {
      await this.syncTicketLinks.execute(slug);
    }

    this.logger.log(
      `Import vé điểm đến: ${created} mới, ${updated} cập nhật, ${errors.length} lỗi`,
    );
    return { created, updated, errors };
  }

  /** true = da co dong khop (sourceUrl trung), duoc goi tinh cap nhat/tao moi o caller */
  private async importRow(
    item: DestinationTicketImportRow,
    orderCounters: Map<string, number>,
  ): Promise<boolean> {
    const destination = await this.mirrorRepo.findBySlug(item.destinationSlug);
    if (!destination) {
      throw new Error(`Không tìm thấy điểm đến "${item.destinationSlug}" trong mirror`);
    }
    const resolved = await this.resolveLink.execute(item.sourceUrl, item.provider);
    const existingRows = await this.tickets.findByDestinationSlug(item.destinationSlug);
    const matched = existingRows.find((r) => r.sourceUrl === item.sourceUrl);

    if (matched) {
      await this.tickets.update(matched.id, {
        label: item.label ?? matched.label,
        provider: resolved.provider,
        sourceUrl: item.sourceUrl,
        affiliateUrl: resolved.affiliateUrl,
        linkStatus: resolved.linkStatus,
        price: item.price !== undefined ? item.price : matched.price,
        thumbnailUrl: item.thumbnailUrl !== undefined ? item.thumbnailUrl : matched.thumbnailUrl,
        order: matched.order,
      });
      return true;
    }

    const nextOrder = orderCounters.get(item.destinationSlug) ?? existingRows.length;
    orderCounters.set(item.destinationSlug, nextOrder + 1);
    await this.tickets.create(item.destinationSlug, {
      label: item.label ?? null,
      provider: resolved.provider,
      sourceUrl: item.sourceUrl,
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
      price: item.price ?? null,
      thumbnailUrl: item.thumbnailUrl ?? null,
      order: nextOrder,
    });
    return false;
  }
}
