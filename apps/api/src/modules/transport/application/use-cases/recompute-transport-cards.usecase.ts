import { Inject, Injectable, Logger } from "@nestjs/common";
import type { TransportMode } from "@zinoflow/contracts";
import { TRANSPORT_SITE_DB, type TransportSiteDb } from "../ports/transport-site-db.port";
import {
  DICHOITHOI_SITE_DB,
  type DichoithoiSiteDb,
} from "../../../destination/application/ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../../../destination/application/ports/destination-mirror.repository";

const MODE_TO_NUM: Record<TransportMode, number> = { flight: 1, bus: 2 };

/**
 * Tinh lai TransportCardsJson cho 1 cum/tinh VA toan bo POI con truc tiep
 * cua no (transport-plan §2 Giai đoạn 4) — cung pattern
 * RecomputeHotelCardsUseCase (Phase 15), khac o cho fan-out xuong POI vi
 * Transport gan theo cum khong theo POI, nhung POI van phai tu thay duoc
 * qua ke thua ParentId (website CHI DOC cot precompute, khong tu resolve
 * ParentId luc render).
 */
@Injectable()
export class RecomputeTransportCardsUseCase {
  private readonly logger = new Logger(RecomputeTransportCardsUseCase.name);

  constructor(
    @Inject(TRANSPORT_SITE_DB) private readonly transportSiteDb: TransportSiteDb,
    @Inject(DICHOITHOI_SITE_DB) private readonly destinationSiteDb: DichoithoiSiteDb,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly destinationRepo: DestinationMirrorRepository,
  ) {}

  /** Tinh lai cho 1 cum/tinh (theo slug) VA moi POI con truc tiep cua no */
  async forStopSlug(destinationSlug: string, mode: TransportMode): Promise<void> {
    const destination = await this.destinationRepo.findBySlug(destinationSlug);
    if (!destination || destination.siteId === null) return;

    await this.forSiteId(destination.siteId, mode);

    const poiSlugs = await this.transportSiteDb.findPoiChildSlugs(destination.siteId);
    for (const poiSlug of poiSlugs) {
      const poi = await this.destinationRepo.findBySlug(poiSlug);
      if (poi?.siteId !== null && poi?.siteId !== undefined) {
        await this.forSiteId(poi.siteId, mode);
      }
    }
    this.logger.log(
      `Tính lại TransportCardsJson cho "${destinationSlug}" + ${poiSlugs.length} POI con`,
    );
  }

  private async forSiteId(siteId: number, mode: TransportMode): Promise<void> {
    const cards = await this.transportSiteDb.findCardsForDestination(siteId, MODE_TO_NUM[mode]);
    await this.destinationSiteDb.updateTransportCards(siteId, JSON.stringify(cards));
  }
}
