import type { ContentImage } from "@zinoflow/contracts";
import type { ContentImageRecord } from "../ports/content-image.repository";

/** Resolve path tuong doi -> URL day du qua DICHOITHOI_CONTENT_IMAGE_BASE_URL */
export function resolveImageUrl(path: string): string {
  const base = process.env.DICHOITHOI_CONTENT_IMAGE_BASE_URL ?? "";
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export function toContentImage(
  record: ContentImageRecord,
  articleTitleByJobId: Map<string, string> = new Map(),
): ContentImage {
  return {
    id: record.id,
    imageUrl: resolveImageUrl(record.path),
    altText: record.altText,
    caption: record.caption,
    width: record.width,
    height: record.height,
    status: record.status,
    usageCount: record.usageCount,
    uploadedAt: record.uploadedAt.toISOString(),
    source: record.source,
    sourceUrl: record.sourceUrl,
    photographer: record.photographer,
    searchKeyword: record.searchKeyword,
    relatedArticle:
      record.relatedJobId && articleTitleByJobId.has(record.relatedJobId)
        ? { jobId: record.relatedJobId, title: articleTitleByJobId.get(record.relatedJobId)! }
        : null,
  };
}
