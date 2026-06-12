import { Inject, Injectable, Logger } from "@nestjs/common";
import type { DestinationTaxonomy } from "@zinoflow/contracts";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Taxonomy cho form/filter: tinh tu admin_provinces (Postgres, seed dvhcvn),
 * loai diem den tu site DB (schema moi). Site loi/chua migrate -> types rong,
 * khong chan UI.
 */
@Injectable()
export class GetDestinationTaxonomyUseCase {
  private readonly logger = new Logger(GetDestinationTaxonomyUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
  ) {}

  async execute(): Promise<DestinationTaxonomy> {
    const provinces = await this.mirrorRepo.listProvinces();

    let types: DestinationTaxonomy["types"] = [];
    if (this.siteDb.isConfigured()) {
      try {
        types = await this.siteDb.fetchTypes();
      } catch (err) {
        // schema moi co the chua duoc tao tren site — taxonomy tinh van dung duoc
        this.logger.warn(`Khong doc duoc DestinationType tu site: ${(err as Error).message}`);
      }
    }

    return { provinces, types };
  }
}
