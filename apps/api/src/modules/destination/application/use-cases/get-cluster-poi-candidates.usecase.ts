import { Inject, Injectable } from "@nestjs/common";
import type { GetClusterPoiCandidatesResponse } from "@zinoflow/contracts";
import {
  CLUSTER_POI_CANDIDATE_REPOSITORY,
  type ClusterPoiCandidateRepository,
} from "../ports/cluster-poi-candidate.repository";

/** Doc dong staging tim diem con trong cum (null = chua tung chay tim cho cum nay) */
@Injectable()
export class GetClusterPoiCandidatesUseCase {
  constructor(
    @Inject(CLUSTER_POI_CANDIDATE_REPOSITORY)
    private readonly candidateRepo: ClusterPoiCandidateRepository,
  ) {}

  async execute(clusterSlug: string): Promise<GetClusterPoiCandidatesResponse> {
    const record = await this.candidateRepo.findByClusterSlug(clusterSlug);
    if (!record) return { candidate: null };
    return {
      candidate: {
        clusterSlug: record.clusterSlug,
        extractedAt: record.extractedAt.toISOString(),
        candidates: record.candidates,
      },
    };
  }
}
