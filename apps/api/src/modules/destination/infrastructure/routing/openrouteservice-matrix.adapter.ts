import { Injectable, Logger } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type {
  DistanceMatrixProvider,
  LatLng,
} from "../../application/ports/distance-matrix-provider.port";

const ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car";
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [0, 1_000, 3_000];

/**
 * Adapter OpenRouteService Matrix API (khoang cach duong bo that, met) —
 * dichoithoi-poi-distance-plan.md Giai doan 1. API key mien phi tai
 * openrouteservice.org, `.env` OPENROUTESERVICE_API_KEY (trong = tinh nang tat,
 * usecase goi phai bao loi ro thay vi im lang dung Haversine — khong che dau
 * viec chua cau hinh).
 *
 * Luu y: ORS Matrix co gioi han so luong toa do toi da/1 lan goi (tuy profile).
 * Adapter nay KHONG tu chia nho — neu vuot gioi han, loi tu ORS se duoc forward
 * nguyen van qua UpstreamApiError de nguoi dung biet ngay, thay vi doan bua 1
 * nguong roi chia sai.
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

    const body = JSON.stringify({
      // ORS dung thu tu [lng, lat], nguoc voi quy uoc lat/lng trong toan bo repo nay.
      locations: locations.map((l) => [l.lng, l.lat]),
      metrics: ["distance"],
    });

    let lastError: Error | null = null;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const res = await fetch(ORS_MATRIX_URL, {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            Authorization: apiKey,
            "Content-Type": "application/json; charset=utf-8",
          },
          body,
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 300)}`);
        }
        const json = (await res.json()) as { distances?: number[][] };
        if (!json.distances) {
          throw new Error("Phản hồi ORS Matrix không có trường distances");
        }
        return json.distances;
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Gọi ORS Matrix lỗi (sẽ retry): ${lastError.message}`);
      }
    }
    throw new UpstreamApiError(
      `Không gọi được OpenRouteService Matrix API: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}
