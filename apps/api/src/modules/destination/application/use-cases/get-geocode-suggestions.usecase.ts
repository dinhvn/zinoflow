import { Inject, Injectable } from "@nestjs/common";
import type { PlaceGeocodeCandidate } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
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
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import {
  buildStagedCandidates,
  LOCATION_BIAS_RADIUS_METERS,
  scoreCandidate,
} from "../services/geocode-candidate-scoring";

export { LOCATION_BIAS_RADIUS_METERS, scoreCandidate };

/**
 * Giai doan 1a (che do tung diem) — dichoithoi-destination-geocode-audit-plan.md.
 * Quet Google Maps LIVE moi lan (khong cache), uu tien toa do gan cum cha
 * (locationBias) neu cum cha da co toa do that. Thong nhat 05/08/2026: KHONG
 * con tra ket qua de FE tu dien thang vao form nua — ket qua duoc UPSERT vao
 * cung bang staging voi Giai doan 1b (dichoithoi_destination_geocode_candidates),
 * duyet qua CUNG 1 panel (GeocodeCandidatesPanel) — chi 1 luong duyet duy nhat
 * cho ca tim tung diem lan tim hang loat.
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
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: DestinationGeocodeCandidateRepository,
  ) {}

  async execute(
    slug: string,
  ): Promise<{ candidates: PlaceGeocodeCandidate[]; usageThisMonth: number }> {
    if (!this.geocoder.isConfigured()) {
      throw new DomainRuleError("Tính năng tìm toạ độ tự động đang tắt");
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

    const staged = buildStagedCandidates(destination.name, results, locationBias);
    await this.candidateRepo.upsert({
      destinationSlug: slug,
      foundAt: new Date(),
      candidates: staged,
      status: staged.length === 0 ? "not-found" : "pending",
    });

    const usageThisMonth = await this.usageRepo.countThisMonth();
    return { candidates, usageThisMonth };
  }
}
