import { Inject, Injectable, Logger } from "@nestjs/common";
import { UpstreamApiError } from "../../../shared/errors/app-error";
import type {
  PlaceGeocodingProvider,
  PlaceTextSearchResult,
} from "../../application/ports/place-geocoding-provider.port";
import {
  PLACES_API_USAGE_REPOSITORY,
  type PlacesApiUsageRepository,
} from "../../application/ports/places-api-usage.repository";

const PLACES_SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText";
const PLACES_DETAILS_URL = "https://places.googleapis.com/v1/places";
const REQUEST_TIMEOUT_MS = 15_000;
const RETRY_DELAYS_MS = [0, 1_000, 3_000];

// Gop CA Pro lan Enterprise trong 1 field mask (chot 05/08/2026: lay het ngay
// dot dau) — LUU Y: Google tinh phi ca request theo SKU cao nhat co trong
// field mask (Enterprise), khong tach rieng phi Pro — xem ghi chu trong
// packages/contracts/src/dichoithoi/geocode.ts.
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.photos",
].join(",");

interface PlacesRawResult {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  googleMapsUri?: string;
  businessStatus?: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY";
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  photos?: Array<{ name: string }>;
}

interface PlacesSearchTextResponse {
  places?: PlacesRawResult[];
}

/**
 * Adapter Google Places API (New) Text Search — dichoithoi-destination-
 * geocode-audit-plan.md Giai doan 0. API key mien phi/tra phi tai
 * console.cloud.google.com, `.env` GOOGLE_MAPS_API_KEY (trong = tinh nang
 * tat, usecase goi phai bao loi ro thay vi im lang).
 */
@Injectable()
export class GooglePlacesProvider implements PlaceGeocodingProvider {
  private readonly logger = new Logger(GooglePlacesProvider.name);

  constructor(
    @Inject(PLACES_API_USAGE_REPOSITORY)
    private readonly usageRepo: PlacesApiUsageRepository,
  ) {}

  isConfigured(): boolean {
    return Boolean(process.env.GOOGLE_MAPS_API_KEY);
  }

  async searchText(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
  ): Promise<PlaceTextSearchResult[]> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new UpstreamApiError(
        "Chưa cấu hình GOOGLE_MAPS_API_KEY trong .env (xem .env.example) — không tìm được toạ độ qua Google Places",
      );
    }

    const body: Record<string, unknown> = { textQuery: query, pageSize: 5 };
    if (locationBias) {
      body.locationBias = {
        circle: {
          center: { latitude: locationBias.lat, longitude: locationBias.lng },
          radius: locationBias.radiusMeters,
        },
      };
    }

    let lastError: Error | null = null;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const startedAt = Date.now();
        const res = await fetch(PLACES_SEARCH_TEXT_URL, {
          method: "POST",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": FIELD_MASK,
          },
          body: JSON.stringify(body),
        });
        const latencyMs = Date.now() - startedAt;
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 500)}`);
        }
        const json = (await res.json()) as PlacesSearchTextResponse;
        await this.usageRepo.record();
        this.logger.log(
          `Places Text Search "${query}" trả về sau ${latencyMs}ms — ${json.places?.length ?? 0} kết quả`,
        );
        return (json.places ?? []).map(toResult);
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Gọi Places API lỗi (sẽ retry): ${lastError.message}`);
      }
    }
    throw new UpstreamApiError(
      `Không gọi được Google Places API: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }

  /** Provider nay khong con duoc wire (xem destination.module.ts) — chi giu de khop interface. */
  async searchTextList(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
  ): Promise<Array<{ href: string; name: string }>> {
    const results = await this.searchText(query, locationBias);
    return results.map((r) => ({ href: r.placeId, name: r.displayName }));
  }

  async getDetails(placeId: string): Promise<PlaceTextSearchResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new UpstreamApiError(
        "Chưa cấu hình GOOGLE_MAPS_API_KEY trong .env (xem .env.example) — không lấy lại được thông tin địa điểm",
      );
    }

    let lastError: Error | null = null;
    for (const delay of RETRY_DELAYS_MS) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const res = await fetch(`${PLACES_DETAILS_URL}/${encodeURIComponent(placeId)}`, {
          method: "GET",
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": FIELD_MASK.replaceAll("places.", "") },
        });
        if (res.status === 404) {
          await this.usageRepo.record();
          return null;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 500)}`);
        }
        const json = (await res.json()) as PlacesRawResult;
        await this.usageRepo.record();
        return toResult(json);
      } catch (err) {
        lastError = err as Error;
        this.logger.warn(`Gọi Places Details lỗi (sẽ retry): ${lastError.message}`);
      }
    }
    throw new UpstreamApiError(
      `Không gọi được Google Places Details API: ${lastError?.message ?? "không rõ nguyên nhân"}`,
    );
  }
}

function toResult(p: PlacesRawResult): PlaceTextSearchResult {
  return {
    placeId: p.id,
    displayName: p.displayName?.text ?? "",
    formattedAddress: p.formattedAddress ?? null,
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    googleMapsUri: p.googleMapsUri ?? null,
    businessStatus: p.businessStatus ?? null,
    nationalPhoneNumber: p.nationalPhoneNumber ?? null,
    websiteUri: p.websiteUri ?? null,
    rating: p.rating ?? null,
    userRatingCount: p.userRatingCount ?? null,
    photoNames: (p.photos ?? []).map((ph) => ph.name),
    webResultUrls: [],
  };
}
