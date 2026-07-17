import { Inject, Injectable } from "@nestjs/common";
import { DICHOITHOI_SITE_DB, type DichoithoiSiteDb } from "../ports/dichoithoi-site-db.port";
import {
  TAXONOMY_SUGGESTION_REPOSITORY,
  type TaxonomySuggestionRepository,
} from "../ports/taxonomy-suggestion.repository";

/**
 * Ghi de TOAN BO Type cua 1 diem den — Kanban ra soat taxonomy (relations-plan §6.2).
 * Danh dau de xuat AI (neu co, §6.3) la accepted — nguoi dung da xu ly diem nay,
 * khong de xuat lai lan chay AI sau, du co lam theo dung de xuat hay tu sua tay.
 */
@Injectable()
export class UpdateDestinationTypesUseCase {
  constructor(
    @Inject(DICHOITHOI_SITE_DB) private readonly siteDb: DichoithoiSiteDb,
    @Inject(TAXONOMY_SUGGESTION_REPOSITORY)
    private readonly suggestionRepo: TaxonomySuggestionRepository,
  ) {}

  async execute(destinationSlug: string, typeSlugs: readonly string[]): Promise<void> {
    await this.siteDb.replaceTypeAssignments(destinationSlug, typeSlugs);
    await this.suggestionRepo.markAccepted(destinationSlug);
  }
}
