import { Injectable, Logger } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type { UrlResolver } from "../../application/ports/url-resolver.port";

const RESOLVE_TIMEOUT_MS = 8_000;

/**
 * Theo redirect cua 1 link rut gon (vd maps.app.goo.gl) bang HEAD request,
 * tra ve URL cuoi cung (destination-spec §2.1.1). Chi theo redirect cong khai,
 * KHONG doc/scrape noi dung trang.
 */
@Injectable()
export class HttpUrlResolver implements UrlResolver {
  private readonly logger = new Logger(HttpUrlResolver.name);

  async resolveRedirect(url: string): Promise<string> {
    assertSafeUrl(url);
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS),
      });
      return response.url || url;
    } catch (err) {
      this.logger.warn(`Resolve redirect loi (${url}): ${err instanceof Error ? err.message : err}`);
      throw new UpstreamApiError(`Không mở được link: ${url}`);
    }
  }
}

/** Chan scheme la + dia chi noi bo (SSRF) — cung nguyen tac voi http-reference-fetcher.ts */
function assertSafeUrl(rawUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UpstreamApiError(`URL không hợp lệ: ${rawUrl}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UpstreamApiError(`Chỉ hỗ trợ http/https (nhận: ${parsed.protocol})`);
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
    throw new UpstreamApiError(`Link trỏ vào địa chỉ nội bộ — không được phép: ${host}`);
  }
}
