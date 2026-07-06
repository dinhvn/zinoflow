import { Injectable, Logger } from "@nestjs/common";
import type { ImageDownloader } from "../../application/ports/image-downloader.port";

const DOWNLOAD_TIMEOUT_MS = 20_000;

/**
 * Tai anh qua HTTP GET (job migrate anh cu). Khong throw — tra null de use case
 * report "missingSource" thay vi fail ca batch.
 */
@Injectable()
export class HttpImageDownloader implements ImageDownloader {
  private readonly logger = new Logger(HttpImageDownloader.name);

  async download(url: string): Promise<Buffer | null> {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) {
        this.logger.warn(`Tai anh that bai ${response.status}: ${url}`);
        return null;
      }
      return Buffer.from(await response.arrayBuffer());
    } catch (err) {
      this.logger.warn(`Tai anh loi mang (${url}): ${err instanceof Error ? err.message : err}`);
      return null;
    }
  }
}
