import { Inject, Injectable, Logger } from "@nestjs/common";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { TRANSPORT_REPOSITORY, type TransportRepository } from "../ports/transport.repository";
import { TRANSPORT_SITE_DB, type TransportSiteDb } from "../ports/transport-site-db.port";
import { RecomputeTransportCardsUseCase } from "./recompute-transport-cards.usecase";

/**
 * Xoa han 1 tuyen (nha xe) — xoa ca Postgres lan SQL Server, roi tinh lai
 * TransportCardsJson cho diem dau/cuoi + POI con de card khong con hien
 * tuyen da xoa (transport-plan §2, bo sung 31/07/2026 theo yeu cau).
 */
@Injectable()
export class DeleteTransportUseCase {
  private readonly logger = new Logger(DeleteTransportUseCase.name);

  constructor(
    @Inject(TRANSPORT_REPOSITORY) private readonly transports: TransportRepository,
    @Inject(TRANSPORT_SITE_DB) private readonly siteDb: TransportSiteDb,
    private readonly recomputeCards: RecomputeTransportCardsUseCase,
  ) {}

  async execute(id: string): Promise<void> {
    const existing = await this.transports.findById(id);
    if (!existing) throw new DomainRuleError(`Không tìm thấy tuyến id=${id}`);

    if (existing.siteId !== null) {
      await this.siteDb.deleteTransport(existing.siteId);
    }
    await this.transports.delete(id);

    const affectedSlugs = existing.stops
      .filter((s) => s.role === "origin" || s.role === "destination")
      .map((s) => s.destinationSlug);
    for (const slug of affectedSlugs) {
      await this.recomputeCards.forStopSlug(slug, existing.mode);
    }

    this.logger.log(`Xoá tuyến "${existing.operatorName}" (id=${id})`);
  }
}
