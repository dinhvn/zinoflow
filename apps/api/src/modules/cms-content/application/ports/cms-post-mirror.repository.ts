import type { ListCmsPostsQuery } from "@zinoflow/contracts";
import type { CmsPostMirrorEntity } from "../../infrastructure/entities/cms-post-mirror.entity";
import type { CmsPostRow } from "../../domain/cms-post";

export const CMS_POST_MIRROR_REPOSITORY = Symbol("CMS_POST_MIRROR_REPOSITORY");

export interface CmsPostMirrorListResult {
  items: CmsPostMirrorEntity[];
  total: number;
}

export interface CmsPostMirrorRepository {
  findByCmsId(cmsId: number): Promise<CmsPostMirrorEntity | null>;
  findAllBySite(siteId: number): Promise<CmsPostMirrorEntity[]>;
  /** List + filter (postType/contentState/search) + sort + phan trang cho UI */
  list(siteId: number, query: ListCmsPostsQuery): Promise<CmsPostMirrorListResult>;

  /** Upsert metadata tu 1 dong WordpressPost (sync). Tra ve "added" | "updated" | "unchanged". */
  upsertFromCms(row: CmsPostRow, syncedAt: Date): Promise<"added" | "updated" | "unchanged">;

  setActiveJob(cmsId: number, jobId: string | null): Promise<void>;
  saveAiInputs(
    cmsId: number,
    notes: string | null,
    referenceUrls: Array<{ label: string; url: string }>,
  ): Promise<void>;
  saveTagHints(cmsId: number, tagHints: string | null): Promise<void>;
  /** Tao dong mirror cho bai moi (INSERT ben CMS xong) — Phase 4 */
  createLocal(row: CmsPostRow): Promise<void>;
  /** Danh dau da ghi content AI xuong CMS (Phase 3) */
  markContentWritten(cmsId: number, writtenAt: Date): Promise<void>;
}
