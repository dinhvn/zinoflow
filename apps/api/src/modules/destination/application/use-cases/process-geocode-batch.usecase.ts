import { Inject, Injectable, Logger } from "@nestjs/common";
import type { GeocodeCandidateStagedItem, RunGeocodeBatchRequest } from "@zinoflow/contracts";
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
  PLACES_API_FREE_TIER_LIMIT,
  PLACES_API_USAGE_REPOSITORY,
  type PlacesApiUsageRepository,
} from "../ports/places-api-usage.repository";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import { matchesGeocodeFilter } from "../services/geocode-target-filter";
import { LOCATION_BIAS_RADIUS_METERS, scoreCandidate } from "./get-geocode-suggestions.usecase";

const MAX_CANDIDATES_PER_DESTINATION = 5;

/**
 * Vong lap that cua Giai doan 1b — chay trong worker (GeocodeBatchWorker),
 * KHONG phai batch AI (khong goi LLM). Kiem tra quota TRUOC MOI lan goi API
 * (khong chi luc bat dau) — dung ngay giua chung neu cham nguong free-tier
 * va nguoi dung chua xac nhan chap nhan phi, ghi log ro da xu ly bao nhieu.
 */
@Injectable()
export class ProcessGeocodeBatchUseCase {
  private readonly logger = new Logger(ProcessGeocodeBatchUseCase.name);

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

  async execute(payload: RunGeocodeBatchRequest): Promise<void> {
    if (!this.geocoder.isConfigured()) {
      this.logger.error("Chưa cấu hình GOOGLE_MAPS_API_KEY — bỏ qua batch geocode");
      return;
    }

    const all = await this.mirrorRepo.findAll();
    const parentCoords = new Map<string, { lat: number; lng: number }>();
    for (const d of all) {
      if (d.lat !== null && d.lng !== null) {
        parentCoords.set(d.slug, { lat: Number(d.lat), lng: Number(d.lng) });
      }
    }
    const targets = all.filter((d) => matchesGeocodeFilter(d, payload));

    let processed = 0;
    let skippedQuota = false;
    for (const dest of targets) {
      const usageThisMonth = await this.usageRepo.countThisMonth();
      if (usageThisMonth >= PLACES_API_FREE_TIER_LIMIT && !payload.acceptCostBeyondFreeTier) {
        skippedQuota = true;
        break;
      }

      try {
        const parent = dest.parentSlug ? parentCoords.get(dest.parentSlug) : undefined;
        const locationBias = parent
          ? { lat: parent.lat, lng: parent.lng, radiusMeters: LOCATION_BIAS_RADIUS_METERS }
          : undefined;
        const parentName = dest.parentSlug ? all.find((d) => d.slug === dest.parentSlug)?.name : null;
        const query = [dest.name, parentName].filter(Boolean).join(", ");

        const results = await this.geocoder.searchText(query, locationBias);
        const staged: GeocodeCandidateStagedItem[] = results
          .map((r) => {
            const distanceToParentMetersAtDiscovery = locationBias
              ? haversineMeters(locationBias.lat, locationBias.lng, r.lat, r.lng)
              : null;
            return {
              placeId: r.placeId,
              displayNameAtDiscovery: r.displayName,
              confidenceScore: scoreCandidate(
                dest.name,
                r.displayName,
                distanceToParentMetersAtDiscovery,
                LOCATION_BIAS_RADIUS_METERS,
              ),
              distanceToParentMetersAtDiscovery,
            };
          })
          .sort((a, b) => b.confidenceScore - a.confidenceScore)
          .slice(0, MAX_CANDIDATES_PER_DESTINATION);

        await this.candidateRepo.upsert({
          destinationSlug: dest.slug,
          foundAt: new Date(),
          candidates: staged,
          status: "pending",
        });
      } catch (err) {
        this.logger.error(
          `Geocode lỗi cho "${dest.slug}": ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      processed += 1;
    }

    this.logger.log(
      `Batch geocode hoàn tất: ${processed}/${targets.length} điểm đã xử lý` +
        (skippedQuota
          ? ` — DỪNG SỚM vì đã chạm ngưỡng free-tier ${PLACES_API_FREE_TIER_LIMIT}/tháng (chưa xác nhận chấp nhận phí)`
          : ""),
    );
  }
}
