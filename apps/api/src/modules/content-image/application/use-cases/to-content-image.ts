import type { ContentImage } from "@zinoflow/contracts";
import type { ContentImageRecord } from "../ports/content-image.repository";

/** Resolve path tuong doi -> URL day du qua DICHOITHOI_CONTENT_IMAGE_BASE_URL */
function resolveImageUrl(path: string): string {
  const base = process.env.DICHOITHOI_CONTENT_IMAGE_BASE_URL ?? "";
  return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export function toContentImage(record: ContentImageRecord): ContentImage {
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
  };
}
