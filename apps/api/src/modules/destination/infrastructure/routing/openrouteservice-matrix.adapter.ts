import { Injectable, Logger } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type {
  DistanceMatrixProvider,
  LatLng,
} from "../../application/ports/distance-matrix-provider.port";

const ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car";
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [0, 1_000, 3_000];

/** Danh dau loi 429 de phan biet voi loi khac khi het retry (xem fetchSubMatrix) */
class OrsRateLimitError extends Error {}
// ORS free tier: toi da 3500 "routes" (sources x destinations) / 1 lan goi. Chua
// 100 lam bien an toan (server co the tinh nhinh hon N*N o bien).
const MAX_ROUTES_PER_REQUEST = 3_400;

/**
 * Adapter OpenRouteService Matrix API (khoang cach duong bo that, met) —
 * dichoithoi-poi-distance-plan.md Giai doan 1. API key mien phi tai
 * openrouteservice.org, `.env` OPENROUTESERVICE_API_KEY (trong = tinh nang tat,
 * usecase goi phai bao loi ro thay vi im lang dung Haversine — khong che dau
 * viec chua cau hinh).
 *
 * ORS Matrix gioi han toi da MAX_ROUTES_PER_REQUEST "routes" (sources x
 * destinations) / 1 lan goi. Khi N*N vuot nguong nay (bug thuc te 22/07/2026:
 * cum Da Lat 71+1 diem = 5184 routes > 3500 sau khi RecomputeGroupDistances
 * gop them ca diem chua publish), adapter TU CHIA thanh nhieu lan goi theo
 * block vuong (dung tham so sources/destinations cua ORS de lay tung phan ma
 * tran), roi ghep lai thanh 1 ma tran day du — thay vi forward loi 400 tho ra
 * usecase nhu truoc (quyet dinh cu tu bo, thay bang chia block ro rang, dung
 * cong thuc co dinh block_size = floor(sqrt(MAX_ROUTES_PER_REQUEST)), khong
 * doan bua nguong).
 */
@Injectable()
export class OpenRouteServiceMatrixAdapter implements DistanceMatrixProvider {
  private readonly logger = new Logger(OpenRouteServiceMatrixAdapter.name);

  isConfigured(): boolean {
    return Boolean(process.env.OPENROUTESERVICE_API_KEY);
  }

  async computeMatrix(locations: readonly LatLng[]): Promise<number[][]> {
    const apiKey = process.env.OPENROUTESERVICE_API_KEY;
    if (!apiKey) {
      throw new UpstreamApiError(
        "Chưa cấu hình OPENROUTESERVICE_API_KEY trong .env (xem .env.example) — không tính được khoảng cách đường bộ",
      );
    }

    const n = locations.length;
    const orsLocations = locations.map((l) => [l.lng, l.lat]);
    const indices = Array.from({ length: n }, (_, i) => i);
    const blockSize = Math.max(1, Math.floor(Math.sqrt(MAX_ROUTES_PER_REQUEST)));
    const blocks = chunk(indices, blockSize);

    this.logger.log(
      `Gọi ORS Matrix: ${n} điểm (${n * n} routes)` +
        (blocks.length > 1
          ? ` — vượt ${MAX_ROUTES_PER_REQUEST}, chia ${blocks.length}x${blocks.length} block (mỗi block tối đa ${blockSize} điểm)`
          : ""),
    );

    const result: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const rowBlock of blocks) {
      for (const colBlock of blocks) {
        const sub = await this.fetchSubMatrix(apiKey, orsLocations, rowBlock, colBlock);
        for (let i = 0; i < rowBlock.length; i += 1) {
          for (let j = 0; j < colBlock.length; j += 1) {
            result[rowBlock[i]!]![colBlock[j]!] = sub[i]![j]!;
          }
        }
      }
    }

    this.logger.log(
      `ORS Matrix hoàn tất — distances[0] (từ điểm đầu tới các điểm còn lại, mét)=${JSON.stringify(result[0])}`,
    );
    return result;
  }

  /** Goi 1 lan ORS Matrix cho 1 block con (sources x destinations), co retry. */
  private async fetchSubMatrix(
    apiKey: string,
    orsLocations: number[][],
    sourceIdx: number[],
    destIdx: number[],
  ): Promise<number[][]> {
    const body = JSON.stringify({
      // ORS dung thu tu [lng, lat], nguoc voi quy uoc lat/lng trong toan bo repo nay.
      locations: orsLocations,
      sources: sourceIdx,
      destinations: destIdx,
      metrics: ["distance"],
    });

    let lastError: Error | null = null;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const startedAt = Date.now();
        const res = await fetch(ORS_MATRIX_URL, {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            Authorization: apiKey,
            "Content-Type": "application/json; charset=utf-8",
          },
          body,
        });
        const latencyMs = Date.now() - startedAt;
        if (res.status === 429) {
          const text = await res.text().catch(() => "");
          throw new OrsRateLimitError(text.slice(0, 300));
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
        }
        const json = (await res.json()) as { distances?: number[][] };
        if (!json.distances) {
          throw new Error("Phản hồi ORS Matrix không có trường distances");
        }
        this.logger.log(
          `  block ${sourceIdx.length}x${destIdx.length} trả về sau ${latencyMs}ms`,
        );
        return json.distances;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Gọi ORS Matrix lỗi (sẽ retry): ${lastError.message}`);
      }
    }
    if (lastError instanceof OrsRateLimitError) {
      throw new UpstreamApiError(
        "Đã vượt giới hạn miễn phí của OpenRouteService (40 request/phút hoặc 500 request/ngày, " +
          "dùng chung cho mọi cụm/tỉnh) — KHÔNG phải lỗi phần mềm. Đợi 1 phút rồi thử lại; " +
          "nếu vẫn lỗi này nghĩa là đã hết 500 request/ngày, phải đợi qua ngày mới (reset theo giờ UTC).",
      );
    }
    throw new UpstreamApiError(
      `Không gọi được OpenRouteService Matrix API: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}
