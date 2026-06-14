import type { CmsContentState, CmsPostSortBy } from "@zinoflow/contracts";

/**
 * Domain rules cho mirror bai viet CMS khuyenmai (laruki/dochoi3s).
 * Thuan TS — suy trang thai noi dung cho UI + sort + bóc tag.
 */

/** 1 dong doc tu bang WordpressPost (SQL Server CMS) */
export interface CmsPostRow {
  cmsId: number;
  siteId: number;
  postId: number;
  postType: number | null;
  title: string;
  link: string | null;
  isReadyAuto: boolean;
  datePublished: Date | null;
  dateUpdated: Date | null;
}

/**
 * Suy trang thai noi dung 1 bai trong AI tool (cot quan trong nhat man list):
 * dang co job > da publish (CMS publish SAU khi ghi AI) > da ghi CMS chua publish > chua co bai.
 */
export function deriveCmsContentState(input: {
  activeContentJobId: string | null;
  aiContentWrittenAt: Date | null;
  datePublished: Date | null;
}): CmsContentState {
  if (input.activeContentJobId) return "dang-soan";
  if (input.aiContentWrittenAt === null) return "chua-co-bai";
  if (input.datePublished && input.datePublished >= input.aiContentWrittenAt) return "da-publish";
  return "da-ghi-cms";
}

/** Bóc danh sach tag [Type_Param:value] trong content (regex như CMS ContentUtil) */
export function extractCmsTags(content: string | null): string[] {
  if (!content) return [];
  const matches = content.match(/\[[^\]]+\]/g);
  return matches ? [...new Set(matches)] : [];
}

export interface CmsPostSortFields {
  title: string;
  postType: number | null;
  contentState: CmsContentState;
  dateUpdated: Date | null;
}

const CONTENT_STATE_RANK: Record<CmsContentState, number> = {
  "chua-co-bai": 0,
  "dang-soan": 1,
  "da-ghi-cms": 2,
  "da-publish": 3,
};

/** Comparator sort cho man list (server-side). */
export function compareCmsPostsForSort(
  sortBy: CmsPostSortBy,
  sortDir: "asc" | "desc",
): (a: CmsPostSortFields, b: CmsPostSortFields) => number {
  const factor = sortDir === "desc" ? -1 : 1;
  return (a, b) => {
    let cmp: number;
    switch (sortBy) {
      case "title":
        cmp = a.title.localeCompare(b.title, "vi");
        break;
      case "postType":
        cmp = (a.postType ?? 999) - (b.postType ?? 999);
        break;
      case "contentState":
        cmp = CONTENT_STATE_RANK[a.contentState] - CONTENT_STATE_RANK[b.contentState];
        break;
      case "dateUpdated":
        cmp = (a.dateUpdated?.getTime() ?? 0) - (b.dateUpdated?.getTime() ?? 0);
        break;
    }
    if (cmp === 0 && sortBy !== "title") cmp = a.title.localeCompare(b.title, "vi");
    return cmp * factor;
  };
}
