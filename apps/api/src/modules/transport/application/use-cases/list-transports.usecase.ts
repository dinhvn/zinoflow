import { Inject, Injectable } from "@nestjs/common";
import type { Transport, TransportMode } from "@zinoflow/contracts";
import {
  TRANSPORT_REPOSITORY,
  type TransportRecord,
  type TransportRepository,
} from "../ports/transport.repository";

export function transportToDto(t: TransportRecord): Transport {
  return {
    id: t.id,
    mode: t.mode,
    operatorName: t.operatorName,
    phone: t.phone,
    vehicleType: t.vehicleType,
    priceFrom: t.priceFrom,
    thumbnailUrl: t.thumbnailUrl,
    provider: t.provider,
    sourceUrl: t.sourceUrl,
    affiliateUrl: t.affiliateUrl,
    linkStatus: t.linkStatus,
    source: t.source,
    siteId: t.siteId,
    stops: t.stops.map((s) => ({
      destinationSlug: s.destinationSlug,
      destinationName: s.destinationName,
      role: s.role,
      seqOrder: s.seqOrder,
    })),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  };
}

/** Danh sach nha xe/hang bay cho man "Vé xe" (transport-plan §3 Giai đoạn 1) */
@Injectable()
export class ListTransportsUseCase {
  constructor(
    @Inject(TRANSPORT_REPOSITORY) private readonly transports: TransportRepository,
  ) {}

  async execute(mode?: TransportMode): Promise<Transport[]> {
    const all = await this.transports.findAll(mode);
    return all.map(transportToDto);
  }
}
