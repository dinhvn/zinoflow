import { Injectable, Logger } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import { stripHtml } from "../../../shared/text/strip-html";
import type { ReferenceFetcher } from "../../application/ports/reference-fetcher.port";

const FETCH_TIMEOUT_MS = 10_000;
/** Gioi han text dua vao prompt (token budget) — 1 nguon ~2k token */
const MAX_TEXT_CHARS = 8_000;
const RETRY_DELAYS_MS = [0, 1_500];

/**
 * Fetch tinh URL nguon tham khao (spec dichoithoi §3.6) — chong SSRF:
 * chi http/https, chan localhost/IP noi bo theo hostname. MVP khong resolve DNS
 * de kiem tra IP dich (du cho nguon cong khai nguoi quan tri tu nhap).
 */
@Injectable()
export class HttpReferenceFetcher implements ReferenceFetcher {
  private readonly logger = new Logger(HttpReferenceFetcher.name);

  async fetchText(url: string): Promise<string> {
    assertSafeUrl(url);

    let lastError: Error | null = null;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          headers: {
            // Mot so trang chan request khong co UA
            "user-agent": "Mozilla/5.0 (compatible; ZinoFlowBot/1.0; +https://dichoithoi.com)",
            accept: "text/html,application/xhtml+xml,text/plain",
          },
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const html = await response.text();
        return stripHtml(html).slice(0, MAX_TEXT_CHARS);
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Fetch nguon tham khao loi (${url}): ${lastError.message}`);
      }
    }
    throw new UpstreamApiError(
      `Không tải được nguồn tham khảo ${url}: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}

/** Chan scheme la + dia chi noi bo (SSRF) — spec §3.6 buoc 1 */
function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UpstreamApiError(`URL nguồn tham khảo không hợp lệ: ${rawUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UpstreamApiError(`Chỉ hỗ trợ nguồn http/https (nhận: ${parsed.protocol})`);
  }
  const host = parsed.hostname.toLowerCase();
  const isPrivate =
    host === "localhost" ||
    host.endsWith(".local") ||
    host === "::1" ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (isPrivate) {
    throw new UpstreamApiError(`Nguồn tham khảo trỏ vào địa chỉ nội bộ — không được phép: ${host}`);
  }
}
