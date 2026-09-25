import { Inject, Injectable, Logger } from "@nestjs/common";
import type {
  ResolveAmbiguousCandidateRequest,
  ResolveAmbiguousCandidateResponse,
} from "@zinoflow/contracts";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import {
  PLACE_GEOCODING_PROVIDER,
  type PlaceGeocodingProvider,
} from "../ports/place-geocoding-provider.port";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";
import { buildStagedCandidates, LOCATION_BIAS_RADIUS_METERS } from "../services/geocode-candidate-scoring";

/**
 * Dung khi dong "ambiguous" chi co ten (chua co toa do — xem
 * ProcessGeocodeBatchUseCase) da duoc xem qua (nguoi dung hoac Claude tu phan
 * tich truc tiep trong chat, yeu cau 10/08/2026) va xac dinh dung 1 candidate.
 * Mo lai CHINH trang do (getDetails) de lay toa do/dia chi that, chuyen dong
 * ve "pending" — VAN phai qua "Chấp nhận" sau do nhu thuong, khong ghi thang
 * vao destination o day.
 */
@Injectable()
export class ResolveAmbiguousCandidateUseCase {
  private readonly logger = new Logger(ResolveAmbiguousCandidateUseCase.name);

  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
    @Inject(PLACE_GEOCODING_PROVIDER)
    private readonly geocoder: PlaceGeocodingProvider,
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: DestinationGeocodeCandidateRepository,
  ) {}

  async execute(request: ResolveAmbiguousCandidateRequest): Promise<ResolveAmbiguousCandidateResponse> {
    let resolved = 0;
    const errors: Array<{ destinationSlug: string; message: string }> = [];

    for (const { destinationSlug, placeId } of request.selections) {
      try {
        const dest = await this.mirrorRepo.findBySlug(destinationSlug);
        if (!dest) {
          errors.push({ destinationSlug, message: "Không tìm thấy điểm đến" });
          continue;
        }
        const parent = dest.parentSlug ? await this.mirrorRepo.findBySlug(dest.parentSlug) : null;
        const locationBias =
          parent?.lat !== null && parent?.lat !== undefined && parent?.lng !== null && parent?.lng !== undefined
            ? { lat: Number(parent.lat), lng: Number(parent.lng), radiusMeters: LOCATION_BIAS_RADIUS_METERS }
            : undefined;

        // Yeu cau 11/08/2026: "tôi muốn bạn lấy cả kết quả web luôn" — chap
        // nhan cham (40-90s/lan) de co san web results ngay, khong can chay
        // rieng "Vet lai Ket qua tren web" sau.
        const details = await this.geocoder.getDetails(placeId);
        const staged = buildStagedCandidates(dest.name, details ? [details] : [], locationBias);
        await this.candidateRepo.upsert({
          destinationSlug,
          foundAt: new Date(),
          candidates: staged,
          status: staged.length === 0 ? "not-found" : "pending",
        });
        if (staged.length > 0) resolved += 1;
        else errors.push({ destinationSlug, message: "Google không còn tìm thấy địa điểm này" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Resolve ambiguous lỗi cho "${destinationSlug}": ${message}`);
        errors.push({ destinationSlug, message });
      }
    }

    return { resolved, errors };
  }
}
