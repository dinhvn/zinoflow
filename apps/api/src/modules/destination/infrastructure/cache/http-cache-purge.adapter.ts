import { Injectable, Logger } from "@nestjs/common";
import type { CachePurgePort } from "../../application/ports/cache-purge.port";

const REQUEST_TIMEOUT_MS = 8_000;

/**
 * Goi endpoint invalidate-cache co san cua website dichoithoi (tang 1 —
 * OutputCache tag "destination:{slug}", Phase 17) va Cloudflare Purge Cache
 * API (tang 2, chi khi da cau hinh CLOUDFLARE_API_TOKEN/ZONE_ID) cho URL vua
 * publish. Publish da thanh cong truoc do — loi purge chi log canh bao, khong
 * throw, vi cache van tu het han theo TTL du sao.
 */
@Injectable()
export class HttpCachePurgeAdapter implements CachePurgePort {
  private readonly logger = new Logger(HttpCachePurgeAdapter.name);

  async purgeDestination(slug: string): Promise<void> {
    await Promise.all([this.purgeSiteOutputCache(slug), this.purgeCloudflare(slug)]);
  }

  private async purgeSiteOutputCache(slug: string): Promise<void> {
    const baseUrl = process.env.DICHOITHOI_SITE_BASE_URL;
    if (!baseUrl) return;
    const url = `${baseUrl.replace(/\/$/, "")}/api/remove-cache/destination:${encodeURIComponent(slug)}`;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      this.logger.warn(`Purge OutputCache website thất bại (${slug}): ${(err as Error).message}`);
    }
  }

  private async purgeCloudflare(slug: string): Promise<void> {
    const token = process.env.CLOUDFLARE_API_TOKEN;
    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    const publicBaseUrl = process.env.DICHOITHOI_PUBLIC_BASE_URL;
    if (!token || !zoneId || !publicBaseUrl) return; // Chua cau hinh Cloudflare — bo qua tang 2

    const targetUrl = `${publicBaseUrl.replace(/\/$/, "")}/diem-den/${slug}`;
    try {
      const res = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`,
        {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ files: [targetUrl] }),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      this.logger.warn(`Purge Cloudflare thất bại (${slug}): ${(err as Error).message}`);
    }
  }
}
