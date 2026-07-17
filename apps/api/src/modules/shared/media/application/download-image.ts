import { UpstreamApiError } from "../../errors/app-error";

const FETCH_TIMEOUT_MS = 15_000;
const MIN_BYTES = 1024; // loai anh 1x1 placeholder/loi tra ve trang html thay anh

/** Tai 1 anh tu URL ngoai ve buffer — dung chung cho ingest-external-image
 * va auto-image-search (dichoithoi-auto-image-search-plan.md §2.2). */
export async function downloadImageBuffer(imageUrl: string): Promise<Buffer> {
  let response: Response;
  try {
    response = await fetch(imageUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    throw new UpstreamApiError(
      `Tải ảnh nguồn thất bại: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    throw new UpstreamApiError(`Tải ảnh nguồn thất bại: HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new UpstreamApiError(`URL không trả về ảnh (content-type: ${contentType || "?"})`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < MIN_BYTES) {
    throw new UpstreamApiError("Ảnh tải về quá nhỏ, có thể là ảnh lỗi/placeholder");
  }
  return buffer;
}
