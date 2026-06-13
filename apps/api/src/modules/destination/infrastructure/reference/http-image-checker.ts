import { Injectable, Logger } from "@nestjs/common";
import type { ImageCheckResult, ImageChecker } from "../../application/ports/image-checker.port";

const HEAD_TIMEOUT_MS = 8_000;

/**
 * Kiem tra anh ton tai bang HEAD request (spec §14.3). Khong nem loi — tra
 * exists=false de UI hien "chua tim thay" thay vi 500. Base URL tu env;
 * thieu config -> exists=false + status=0 (UI nhac cau hinh).
 */
@Injectable()
export class HttpImageChecker implements ImageChecker {
  private readonly logger = new Logger(HttpImageChecker.name);

  async check(path: string): Promise<ImageCheckResult> {
    const url = this.buildUrl(path);
    if (!url) {
      return { url: path, exists: false, status: 0 };
    }
    try {
      const response = await fetch(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(HEAD_TIMEOUT_MS),
      });
      return { url, exists: response.ok, status: response.status };
    } catch (err) {
      this.logger.warn(`HEAD anh loi (${url}): ${err instanceof Error ? err.message : err}`);
      return { url, exists: false, status: 0 };
    }
  }

  /** Ghep base + path, tranh thieu/thua dau "/" giua hai phan */
  private buildUrl(path: string): string | null {
    const base = process.env.DICHOITHOI_IMAGE_BASE_URL;
    if (!base) return null;
    const cleanBase = base.replace(/\/+$/, "");
    const cleanPath = path.replace(/^\/+/, "");
    return `${cleanBase}/${cleanPath}`;
  }
}
