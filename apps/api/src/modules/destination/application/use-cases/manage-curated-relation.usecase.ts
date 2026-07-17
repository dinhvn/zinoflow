import { Inject, Injectable } from "@nestjs/common";
import type { ManageCuratedRelationRequest } from "@zinoflow/contracts";
import {
  DESTINATION_RELATION_REPOSITORY,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";

const MANUAL_WEIGHT = 100;

/**
 * Noi/xoa quan he curated tay tren ban do (relations-plan §5.7 muc 1-2,
 * Giai doan C4) — ghi CA 2 CHIEU (A->B va B->A), khac excluded (1 chieu),
 * vi "2 diem lien quan nhau" la quan he doi xung tu goc nhin nguoi dung.
 */
@Injectable()
export class ManageCuratedRelationUseCase {
  constructor(
    @Inject(DESTINATION_RELATION_REPOSITORY)
    private readonly relationRepo: DestinationRelationRepository,
  ) {}

  async execute(request: ManageCuratedRelationRequest): Promise<void> {
    const { sourceSlug, targetSlug, action } = request;
    if (action === "add") {
      await Promise.all([
        this.relationRepo.addCuratedRelated(sourceSlug, targetSlug, MANUAL_WEIGHT),
        this.relationRepo.addCuratedRelated(targetSlug, sourceSlug, MANUAL_WEIGHT),
      ]);
    } else {
      await Promise.all([
        this.relationRepo.removeCuratedRelated(sourceSlug, targetSlug),
        this.relationRepo.removeCuratedRelated(targetSlug, sourceSlug),
      ]);
    }
  }
}
