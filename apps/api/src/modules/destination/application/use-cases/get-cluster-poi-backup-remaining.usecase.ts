import { Inject, Injectable } from "@nestjs/common";
import type { GetClusterPoiBackupRemainingResponse } from "@zinoflow/contracts";
import {
  CLUSTER_POI_BACKUP_REPOSITORY,
  type ClusterPoiBackupRepository,
} from "../ports/cluster-poi-backup.repository";

/**
 * Man "Backup con lai" (GD7 plan-lam-moi-du-lieu-atlas.md) — dieu kien cung chong
 * mat du lieu am tham: dot lam moi du lieu theo Atlas chi coi la XONG khi man nay
 * ve 0 dong (moi dong backup deu da khoi phuc vao 1 cum, hoac nguoi dung tu quyet
 * dinh bo han).
 */
@Injectable()
export class GetClusterPoiBackupRemainingUseCase {
  constructor(
    @Inject(CLUSTER_POI_BACKUP_REPOSITORY)
    private readonly backupRepo: ClusterPoiBackupRepository,
  ) {}

  async execute(): Promise<GetClusterPoiBackupRemainingResponse> {
    const rows = await this.backupRepo.findAllUnrestored();
    return {
      count: rows.length,
      items: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        provinceCode: r.provinceCode,
        hasArticle: r.draftArticle !== null,
        hasImages: Boolean(r.thumbnail) || r.gallery.length > 0,
        shortDescription: r.shortDescription,
      })),
    };
  }
}
