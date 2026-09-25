import { Inject, Injectable } from "@nestjs/common";
import type { SkipGeocodeCandidatesRequest, SkipGeocodeCandidatesResponse } from "@zinoflow/contracts";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";

/**
 * Nut "Bo qua" trong bang duyet ket qua tim toa do (yeu cau 08/08/2026) —
 * danh dau "rejected" thay vi ghi du lieu vao destination. Khac voi khong
 * lam gi: "rejected" bi excludeAlreadyAttempted() loai VINH VIEN khoi cac
 * lan chay batch filter sau (xem geocode-target-filter.ts), nen diem nay se
 * khong bi quet lai — nguoi dung tu kiem tra tay rieng khi can.
 */
@Injectable()
export class SkipGeocodeCandidatesUseCase {
  constructor(
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: DestinationGeocodeCandidateRepository,
  ) {}

  async execute(request: SkipGeocodeCandidatesRequest): Promise<SkipGeocodeCandidatesResponse> {
    for (const slug of request.slugs) {
      await this.candidateRepo.setStatus(slug, "rejected");
    }
    return { updated: request.slugs.length };
  }
}
