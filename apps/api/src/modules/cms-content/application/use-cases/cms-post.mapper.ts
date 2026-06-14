import { khuyenmaiSiteFromId, type CmsPost } from "@zinoflow/contracts";
import type { CmsPostMirrorEntity } from "../../infrastructure/entities/cms-post-mirror.entity";
import { deriveCmsContentState } from "../../domain/cms-post";

/** Map dong mirror -> DTO CmsPost cho UI (suy contentState + site tu siteId). */
export function toCmsPostDto(e: CmsPostMirrorEntity): CmsPost {
  return {
    cmsId: e.cmsId,
    site: khuyenmaiSiteFromId(e.siteId) ?? "laruki",
    postId: e.postId,
    title: e.title,
    link: e.link,
    postType: e.postType,
    contentState: deriveCmsContentState({
      activeContentJobId: e.activeContentJobId,
      aiContentWrittenAt: e.aiContentWrittenAt,
      datePublished: e.datePublished,
    }),
    isReadyAuto: e.isReadyAuto,
    activeContentJobId: e.activeContentJobId,
    datePublished: e.datePublished?.toISOString() ?? null,
    dateUpdated: e.dateUpdated?.toISOString() ?? null,
  };
}
