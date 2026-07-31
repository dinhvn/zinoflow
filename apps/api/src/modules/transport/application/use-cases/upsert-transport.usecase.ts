import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Transport, UpsertTransportRequest } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";
import {
  TRANSPORT_REPOSITORY,
  type TransportRepository,
  type UpsertTransportInput,
} from "../ports/transport.repository";
import { TRANSPORT_SITE_DB, type TransportSiteDb } from "../ports/transport-site-db.port";
import { ResolveAffiliateLinkUseCase } from "../../../affiliate/application/use-cases/resolve-affiliate-link.usecase";
import { transportToDto } from "./list-transports.usecase";
import { RecomputeTransportCardsUseCase } from "./recompute-transport-cards.usecase";

const MODE_TO_NUM = { flight: 1, bus: 2 } as const;

/**
 * Tao moi / sua 1 tuyen (nha xe/hang bay) — publish THANG xuong SQL Server
 * ngay (khong AI, khong quality gate, khong review 2 chot — giong Hotel).
 * Validate dung 1 diem dau + dung 1 diem cuoi, diem dung phai la node
 * cluster/province co that (transport-plan §2).
 */
@Injectable()
export class UpsertTransportUseCase {
  private readonly logger = new Logger(UpsertTransportUseCase.name);

  constructor(
    @Inject(TRANSPORT_REPOSITORY) private readonly transports: TransportRepository,
    @Inject(TRANSPORT_SITE_DB) private readonly siteDb: TransportSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinations: DestinationMirrorRepository,
    private readonly resolveLink: ResolveAffiliateLinkUseCase,
    private readonly recomputeCards: RecomputeTransportCardsUseCase,
  ) {}

  async create(request: UpsertTransportRequest): Promise<Transport> {
    const input = await this.toInput(request);
    const created = await this.transports.create(input);
    await this.publish(created.id, null, input);
    const withSite = await this.transports.findById(created.id);
    if (!withSite) throw new DomainRuleError("Tuyến xe biến mất ngay sau khi tạo");
    await this.recomputeAffectedStops(input.mode, input.stops, []);
    return transportToDto(withSite);
  }

  async update(id: string, request: UpsertTransportRequest): Promise<Transport> {
    const existing = await this.transports.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy tuyến id=${id}`);
    const input = await this.toInput(request);
    await this.transports.update(id, input);
    await this.publish(id, existing.siteId, input);
    const updated = await this.transports.findById(id);
    if (!updated) throw new DomainRuleError("Tuyến xe biến mất ngay sau khi cập nhật");
    await this.recomputeAffectedStops(input.mode, input.stops, existing.stops);
    return transportToDto(updated);
  }

  /**
   * Tinh lai TransportCardsJson cho moi diem origin/destination CU + MOI
   * (union, khu trung) — bat buoc goi ca stop cu vi neu doi diem cuoi/dau,
   * diem cu se con giu the sai (transport-plan §2) neu khong xoa lai.
   */
  private async recomputeAffectedStops(
    mode: UpsertTransportInput["mode"],
    newStops: UpsertTransportInput["stops"],
    oldStops: Array<{ destinationSlug: string; role: string }>,
  ): Promise<void> {
    const affected = new Set<string>();
    for (const s of [...newStops, ...oldStops]) {
      if (s.role === "origin" || s.role === "destination") affected.add(s.destinationSlug);
    }
    for (const slug of affected) {
      await this.recomputeCards.forStopSlug(slug, mode);
    }
  }

  private async toInput(request: UpsertTransportRequest): Promise<UpsertTransportInput> {
    await this.validateStops(request.stops);

    const sourceUrl = request.sourceUrl?.trim() || null;
    const resolved = sourceUrl
      ? await this.resolveLink.execute(sourceUrl, request.provider ?? null)
      : null;

    return {
      mode: request.mode,
      operatorName: request.operatorName.trim(),
      phone: request.phone?.trim() || null,
      vehicleType: request.vehicleType?.trim() || null,
      priceFrom: request.priceFrom ?? null,
      thumbnailUrl: request.thumbnailUrl?.trim() || null,
      provider: resolved?.provider ?? request.provider?.trim() ?? null,
      sourceUrl,
      affiliateUrl: resolved?.affiliateUrl ?? null,
      linkStatus: resolved?.linkStatus ?? "no-link",
      stops: request.stops.map((s) => ({
        destinationSlug: s.destinationSlug,
        role: s.role,
        seqOrder: s.seqOrder,
      })),
    };
  }

  /**
   * Dung DUNG 1 origin + DUNG 1 destination, moi diem phai la node co that
   * voi kind IN (cluster, province) — xe khong toi 1 diem tham quan cu the
   * (transport-plan §2).
   */
  private async validateStops(stops: UpsertTransportRequest["stops"]): Promise<void> {
    const origins = stops.filter((s) => s.role === "origin");
    const destinations = stops.filter((s) => s.role === "destination");
    if (origins.length !== 1) {
      throw new DomainRuleError("Tuyến xe phải có đúng 1 điểm đầu");
    }
    if (destinations.length !== 1) {
      throw new DomainRuleError("Tuyến xe phải có đúng 1 điểm cuối");
    }
    for (const stop of stops) {
      const dest = await this.destinations.findBySlug(stop.destinationSlug);
      if (!dest) {
        throw new DomainRuleError(`Không tìm thấy điểm đến "${stop.destinationSlug}"`);
      }
      if (dest.kind === "poi") {
        throw new DomainRuleError(
          `"${dest.name}" là điểm tham quan cụ thể — chỉ được chọn cụm/tỉnh cho tuyến xe`,
        );
      }
    }
  }

  private async publish(
    id: string,
    siteId: number | null,
    input: UpsertTransportInput,
  ): Promise<void> {
    const { siteId: newSiteId } = await this.siteDb.upsertTransport({
      siteId,
      mode: MODE_TO_NUM[input.mode],
      operatorName: input.operatorName,
      phone: input.phone,
      vehicleType: input.vehicleType,
      priceFrom: input.priceFrom,
      thumbnailUrl: input.thumbnailUrl,
      provider: input.provider,
      sourceUrl: input.sourceUrl,
      affiliateUrl: input.affiliateUrl,
      linkStatus: input.linkStatus,
    });
    await this.siteDb.replaceStops(newSiteId, input.stops);
    if (siteId === null) {
      await this.transports.setSiteId(id, newSiteId);
      this.logger.log(`Publish tuyến xe mới "${input.operatorName}" -> siteId ${newSiteId}`);
    }
  }
}
