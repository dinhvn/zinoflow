import { Inject, Injectable } from "@nestjs/common";
import type { PlaceGeocodeCandidate } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";
import { haversineMeters } from "../../domain/related-builder";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  PLACE_GEOCODING_PROVIDER,
  type PlaceGeocodingProvider,
} from "../ports/place-geocoding-provider.port";
import {
  PLACES_API_USAGE_REPOSITORY,
  type PlacesApiUsageRepository,
} from "../ports/places-api-usage.repository";

/** Ban kinh location bias quanh toa do cum cha — cum du lich thuong trai vai chuc km */
export const LOCATION_BIAS_RADIUS_METERS = 20_000;

/**
 * Giai doan 1a (che do tung diem) — dichoithoi-destination-geocode-audit-plan.md.
 * Goi Google Places Text Search LIVE moi lan (khong luu cache), uu tien toa do
 * gan cum cha (locationBias) neu cum cha da co toa do that. KHONG ghi gi vao
 * destination — chi tra danh sach goi y de nguoi dung tu chon roi bam Luu tren
 * form co san (dung Cua C, xem dichoithoi-system-overview.md §2.2).
 */
@Injectable()
export class GetGeocodeSuggestionsUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(PLACE_GEOCODING_PROVIDER)
    private readonly geocoder: PlaceGeocodingProvider,
    @Inject(PLACES_API_USAGE_REPOSITORY)
    private readonly usageRepo: PlacesApiUsageRepository,
  ) {}

  async execute(
    slug: string,
  ): Promise<{ candidates: PlaceGeocodeCandidate[]; usageThisMonth: number }> {
    if (!this.geocoder.isConfigured()) {
      throw new DomainRuleError(
        "Chưa cấu hình GOOGLE_MAPS_API_KEY — tính năng tìm toạ độ tự động đang tắt",
      );
    }

    const all = await this.mirrorRepo.findAll();
    const destination = all.find((d) => d.slug === slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}"`);
    }

    const parent = destination.parentSlug
      ? (all.find((d) => d.slug === destination.parentSlug) ?? null)
      : null;
    const locationBias =
      parent && parent.lat !== null && parent.lng !== null
        ? {
            lat: Number(parent.lat),
            lng: Number(parent.lng),
            radiusMeters: LOCATION_BIAS_RADIUS_METERS,
          }
        : undefined;

    const query = [destination.name, parent?.name].filter(Boolean).join(", ");
    const results = await this.geocoder.searchText(query, locationBias);

    const candidates: PlaceGeocodeCandidate[] = results
      .map((r) => {
        const distanceToParentMeters = locationBias
          ? haversineMeters(locationBias.lat, locationBias.lng, r.lat, r.lng)
          : null;
        return {
          ...r,
          distanceToParentMeters,
          confidenceScore: scoreCandidate(
            destination.name,
            r.displayName,
            distanceToParentMeters,
            LOCATION_BIAS_RADIUS_METERS,
          ),
        };
      })
      .sort((a, b) => b.confidenceScore - a.confidenceScore);

    const usageThisMonth = await this.usageRepo.countThisMonth();
    return { candidates, usageThisMonth };
  }
}

/**
 * 0-1, 60% do giong ten (Jaccard token, chuan hoa tieng Viet) + 40% khoang
 * cach toi cum cha (cang gan cum cha cang cao, xa hon ban kinh bias = 0).
 * distanceMeters=null (khong co cum cha co toa do) → coi nhu trung tinh 0.5.
 */
export function scoreCandidate(
  targetName: string,
  candidateName: string,
  distanceMeters: number | null,
  radiusMeters: number,
): number {
  const nameScore = nameSimilarity(targetName, candidateName);
  const distanceScore = distanceMeters === null ? 0.5 : Math.max(0, 1 - distanceMeters / radiusMeters);
  return Math.round((0.6 * nameScore + 0.4 * distanceScore) * 100) / 100;
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeVietnamese(a);
  const nb = normalizeVietnamese(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}
