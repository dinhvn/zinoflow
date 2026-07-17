import { Inject, Injectable } from "@nestjs/common";
import type { ManageExcludedRelationRequest } from "@zinoflow/contracts";
import {
  DESTINATION_RELATION_REPOSITORY,
  type DestinationRelationRepository,
} from "../ports/destination-mirror.repository";

/**
 * Loai tru 1 goi y tu dong khoi RelatedJson cua sourceSlug (relations-plan
 * §5.7 muc 3, Giai doan C4) — CHI 1 CHIEU (khac curated), vi day la nhan xet
 * "goi y NAY cho DIEM NAY sai", khong phai quan he doi xung.
 */
@Injectable()
export class ManageExcludedRelationUseCase {
  constructor(
    @Inject(DESTINATION_RELATION_REPOSITORY)
    private readonly relationRepo: DestinationRelationRepository,
  ) {}

  async execute(request: ManageExcludedRelationRequest): Promise<void> {
    const { sourceSlug, targetSlug, action } = request;
    if (action === "add") {
      await this.relationRepo.addExcluded(sourceSlug, targetSlug);
    } else {
      await this.relationRepo.removeExcluded(sourceSlug, targetSlug);
    }
  }
}
