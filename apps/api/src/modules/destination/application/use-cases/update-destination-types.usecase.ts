import { Inject, Injectable } from "@nestjs/common";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  TAXONOMY_SUGGESTION_REPOSITORY,
  type TaxonomySuggestionRepository,
} from "../ports/taxonomy-suggestion.repository";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";

/**
 * Ghi de TOAN BO Type cua 1 diem den — Kanban ra soat taxonomy (relations-plan §6.2).
 * Danh dau de xuat AI (neu co, §6.3) la accepted — nguoi dung da xu ly diem nay,
 * khong de xuat lai lan chay AI sau, du co lam theo dung de xuat hay tu sua tay.
 *
 * Diem CHUA publish (siteId=null) khong co DestinationId ben SQL Server nen ghi
 * tam vao mirror.types (Postgres) thay vi goi SQL Server — PublishDestinationUseCase
 * se day sang v2.DestinationTypeMap khi publish lan dau (twin cua ApplyTagAssignmentsUseCase,
 * phan hoi nguoi dung 26/07/2026).
 */
@Injectable()
export class UpdateDestinationTypesUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(TAXONOMY_SUGGESTION_REPOSITORY)
    private readonly suggestionRepo: TaxonomySuggestionRepository,
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(destinationSlug: string, typeSlugs: readonly string[]): Promise<void> {
    const mirror = await this.mirrorRepo.findBySlug(destinationSlug);
    if (mirror && mirror.siteId === null) {
      await this.mirrorRepo.setTypes(destinationSlug, typeSlugs);
    } else {
      await this.siteDb.replaceTypeAssignments(destinationSlug, typeSlugs);
    }
    await this.suggestionRepo.markAccepted(destinationSlug);
  }
}
