import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  CreateDestinationTicketRequest,
  DestinationTicket,
  DestinationTicketWithDestination,
  UpdateDestinationTicketRequest,
} from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_TICKET_REPOSITORY,
  type DestinationTicketRecord,
  type DestinationTicketRepository,
} from "../ports/destination-ticket.repository";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { SyncDestinationTicketLinksService } from "../services/sync-destination-ticket-links.service";

function toDto(r: DestinationTicketRecord): DestinationTicket {
  return {
    id: r.id,
    destinationSlug: r.destinationSlug,
    label: r.label,
    provider: r.provider,
    sourceUrl: r.sourceUrl,
    affiliateUrl: r.affiliateUrl,
    linkStatus: r.linkStatus,
    price: r.price,
    thumbnailUrl: r.thumbnailUrl,
    order: r.order,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * CRUD "Vé tham quan" — bảng destination_tickets, quản lý giống Hotel/Tour
 * (doc dichoithoi-ticket-analysis.md §11.5). affiliateUrl/linkStatus server
 * tự tính qua AffiliateLinkResolver lúc lưu (giống ticketLinks cũ). Sau mỗi
 * thay đổi, đồng bộ lại cache ticketLinks (mirror + SQL Server nếu đã publish).
 */
@Injectable()
export class ManageDestinationTicketsUseCase {
  private readonly logger = new Logger(ManageDestinationTicketsUseCase.name);

  constructor(
    @Inject(DESTINATION_TICKET_REPOSITORY)
    private readonly tickets: DestinationTicketRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly syncTicketLinks: SyncDestinationTicketLinksService,
  ) {}

  async listAll(): Promise<DestinationTicketWithDestination[]> {
    const [rows, destinations] = await Promise.all([
      this.tickets.findAll(),
      this.mirrorRepo.findAll(),
    ]);
    const provinces = await this.mirrorRepo.listProvinces();
    const provinceNameByCode = new Map(provinces.map((p) => [p.provinceCode, p.shortName]));
    const bySlug = new Map(destinations.map((d) => [d.slug, d]));
    return rows.map((r) => {
      const destination = bySlug.get(r.destinationSlug);
      return {
        ...toDto(r),
        destinationName: destination?.name ?? r.destinationSlug,
        provinceName: destination?.provinceCode
          ? provinceNameByCode.get(destination.provinceCode) ?? null
          : null,
      };
    });
  }

  async listForDestination(destinationSlug: string): Promise<DestinationTicket[]> {
    const rows = await this.tickets.findByDestinationSlug(destinationSlug);
    return rows.map(toDto);
  }

  async create(
    destinationSlug: string,
    request: CreateDestinationTicketRequest,
  ): Promise<DestinationTicket> {
    const destination = await this.mirrorRepo.findBySlug(destinationSlug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${destinationSlug}" trong mirror`);
    }
    const resolved = await this.resolveLink.execute(request.sourceUrl, request.provider);
    const existing = await this.tickets.findByDestinationSlug(destinationSlug);
    const created = await this.tickets.create(destinationSlug, {
      label: request.label ?? null,
      provider: resolved.provider,
      sourceUrl: request.sourceUrl,
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
      price: request.price ?? null,
      thumbnailUrl: request.thumbnailUrl ?? null,
      order: existing.length,
    });
    await this.syncTicketLinks.execute(destinationSlug);
    this.logger.log(`Thêm vé cho ${destinationSlug} (provider=${resolved.provider})`);
    return toDto(created);
  }

  async update(id: string, request: UpdateDestinationTicketRequest): Promise<DestinationTicket> {
    const existing = await this.tickets.findById(id);
    if (!existing) {
      throw new DomainRuleError(`Không tìm thấy vé id=${id}`);
    }
    const provider = request.provider ?? existing.provider;
    const sourceUrl = request.sourceUrl ?? existing.sourceUrl;
    const resolved = await this.resolveLink.execute(sourceUrl, provider);
    const updated = await this.tickets.update(id, {
      label: request.label !== undefined ? request.label : existing.label,
      provider: resolved.provider,
      sourceUrl,
      affiliateUrl: resolved.affiliateUrl,
      linkStatus: resolved.linkStatus,
      price: request.price !== undefined ? request.price : existing.price,
      thumbnailUrl: request.thumbnailUrl !== undefined ? request.thumbnailUrl : existing.thumbnailUrl,
      order: existing.order,
    });
    await this.syncTicketLinks.execute(existing.destinationSlug);
    return toDto(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.tickets.findById(id);
    if (!existing) {
      throw new DomainRuleError(`Không tìm thấy vé id=${id}`);
    }
    await this.tickets.delete(id);
    await this.syncTicketLinks.execute(existing.destinationSlug);
  }
}
