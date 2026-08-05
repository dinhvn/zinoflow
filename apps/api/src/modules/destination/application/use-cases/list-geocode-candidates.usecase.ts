import { Inject, Injectable } from "@nestjs/common";
import type { ListGeocodeCandidatesResponse } from "@zinoflow/contracts";
import {
  DESTINATION_GEOCODE_CANDIDATE_REPOSITORY,
  type DestinationGeocodeCandidateRepository,
} from "../ports/destination-geocode-candidate.repository";

/** Danh sach dong staging con "pending" — dung cho bang duyet hang loat (Giai doan 1b) */
@Injectable()
export class ListGeocodeCandidatesUseCase {
  constructor(
    @Inject(DESTINATION_GEOCODE_CANDIDATE_REPOSITORY)
    private readonly repo: DestinationGeocodeCandidateRepository,
  ) {}

  async execute(): Promise<ListGeocodeCandidatesResponse> {
    const records = await this.repo.findPending();
    return {
      records: records.map((r) => ({
        destinationSlug: r.destinationSlug,
        foundAt: r.foundAt.toISOString(),
        candidates: r.candidates,
        status: r.status,
      })),
    };
  }
}
