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
    const [provinces, mirrors] = await Promise.all([
      this.mirrorRepo.listProvinces(),
      this.mirrorRepo.findAll(),
    ]);

    let types: DestinationTaxonomy["types"] = [];
    let siteClusters: DestinationTaxonomy["clusters"] = [];
    if (this.siteDb.isConfigured()) {
      try {
        types = await this.siteDb.fetchTypes();
      } catch (err) {
        // schema moi co the chua duoc tao tren site — taxonomy tinh van dung duoc
        this.logger.warn(`Khong doc duoc DestinationType tu site: ${(err as Error).message}`);
      }
      try {
        const allDestinations = await this.siteDb.fetchAllDestinations();
        siteClusters = allDestinations
          .filter((d) => d.kind === "province" || d.kind === "cluster")
          .map((d) => ({
            slug: d.slug,
            name: d.name,
            kind: d.kind as "province" | "cluster",
            provinceCode: d.provinceCode,
          }));
      } catch (err) {
        this.logger.warn(`Khong doc duoc danh sach tinh/cum tu site: ${(err as Error).message}`);
      }
    }

    // Gom them cum/tinh CHUA publish (mirror.siteId=null) — chua co tren site DB
    const draftClusters = mirrors
      .filter((m) => m.siteId === null && (m.kind === "province" || m.kind === "cluster"))
      .map((m) => ({
        slug: m.slug,
        name: m.name,
        kind: m.kind as "province" | "cluster",
        provinceCode: m.provinceCode,
      }));

    const clusters = [...siteClusters, ...draftClusters].sort((a, b) =>
      a.name.localeCompare(b.name, "vi"),
    );

    return { provinces, types, clusters };
  }
}
