import { Inject, Injectable, Logger } from "@nestjs/common";
import { KHUYENMAI_SITE_ID, type KhuyenmaiSite, type SyncCmsPostsResult } from "@zinoflow/contracts";
import {
  CMS_POST_MIRROR_REPOSITORY,
  type CmsPostMirrorRepository,
} from "../ports/cms-post-mirror.repository";
import { KHUYENMAI_CMS_DB, type KhuyenMaiCmsDb } from "../ports/khuyenmai-cms-db.port";

/** Dong bo mirror bai viet tu CMS (1 chieu doc) theo site — nut "Dong bo tu CMS". */
@Injectable()
export class SyncCmsPostsUseCase {
  private readonly logger = new Logger(SyncCmsPostsUseCase.name);

  constructor(
    @Inject(CMS_POST_MIRROR_REPOSITORY) private readonly mirror: CmsPostMirrorRepository,
    @Inject(KHUYENMAI_CMS_DB) private readonly cmsDb: KhuyenMaiCmsDb,
  ) {}

  async execute(site: KhuyenmaiSite): Promise<SyncCmsPostsResult> {
    const startedAt = Date.now();
    const rows = await this.cmsDb.fetchPosts(KHUYENMAI_SITE_ID[site]);
    const syncedAt = new Date();
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    for (const row of rows) {
      const action = await this.mirror.upsertFromCms(row, syncedAt);
      if (action === "added") added += 1;
      else if (action === "updated") updated += 1;
      else unchanged += 1;
    }
    this.logger.log(`Sync CMS ${site}: them ${added}, cap nhat ${updated}, khong doi ${unchanged}`);
    return { added, updated, unchanged, durationMs: Date.now() - startedAt };
  }
}
