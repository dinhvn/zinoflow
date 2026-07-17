import { Injectable, Logger } from "@nestjs/common";
import type { StockImageCandidate, StockImageSearchPort } from "../application/ports/stock-image-search.port";

const PEXELS_SEARCH_URL = "https://api.pexels.com/v1/search";
const FETCH_TIMEOUT_MS = 10_000;

interface PexelsPhoto {
  src: { large: string };
  url: string;
  photographer: string | null;
}
interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

/**
 * Adapter Pexels (dichoithoi-auto-image-search-plan.md §1.1 — mac dinh vi
 * giay phep khong yeu cau credit, an toan nhat cho site kiem tien). Can
 * PEXELS_API_KEY that (dang ky mien phi tai pexels.com/api) — thieu key thi
 * tra ve rong (khong nem loi, coi nhu tinh nang chua bat), giong quy uoc
 * IMAGE_UPLOADER khi thieu cau hinh FTP.
 */
@Injectable()
export class PexelsStockImageSearchAdapter implements StockImageSearchPort {
  private readonly logger = new Logger(PexelsStockImageSearchAdapter.name);

  async search(keyword: string, limit: number): Promise<StockImageCandidate[]> {
    const apiKey = process.env.PEXELS_API_KEY;
    if (!apiKey) {
      this.logger.warn("PEXELS_API_KEY chưa cấu hình — bỏ qua tìm ảnh tự động");
      return [];
    }

    const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(keyword)}&per_page=${limit}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(`Gọi Pexels thất bại (${keyword}): ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
    if (!response.ok) {
      this.logger.error(`Pexels trả lỗi HTTP ${response.status} cho từ khoá "${keyword}"`);
      return [];
    }

    const body = (await response.json()) as PexelsSearchResponse;
    return body.photos.map((photo) => ({
      imageUrl: photo.src.large,
      source: "pexels",
      sourceUrl: photo.url,
      photographer: photo.photographer,
    }));
  }
}
