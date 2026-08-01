import { Inject, Injectable } from "@nestjs/common";
import type { BulkApplyTaxonomySuggestionsResponse } from "@zinoflow/contracts";
import {
  TAXONOMY_SUGGESTION_REPOSITORY,
  type TaxonomySuggestionRepository,
} from "../ports/taxonomy-suggestion.repository";
import { UpdateDestinationTypesUseCase } from "./update-destination-types.usecase";

/**
 * Ap dung HANG LOAT de xuat AI "pending" cho danh sach diem NGUOI DUNG DA CHON
 * o man review truoc (Kanban ra soat taxonomy, relations-plan §6.3) — khong tu
 * ghi ca cum, chi ghi nhung diem duoc tick sau khi xem bang so sanh cu/moi + ly do
 * (phan hoi 24/07/2026: khong tin AI 100%, phai xem truoc roi moi ap dung).
 *
 * Tai su dung UpdateDestinationTypesUseCase cho tung diem de dung 1 duong ghi
 * (mirror neu chua publish / SQL Server neu da publish) + markAccepted, giong
 * het luong ap dung tung the mot.
 */
@Injectable()
export class BulkApplyTaxonomySuggestionsUseCase {
  constructor(
    @Inject(TAXONOMY_SUGGESTION_REPOSITORY)
    private readonly suggestionRepo: TaxonomySuggestionRepository,
    private readonly updateTypes: UpdateDestinationTypesUseCase,
  ) {}

  async execute(destinationSlugs: readonly string[]): Promise<BulkApplyTaxonomySuggestionsResponse> {
    const allSuggestions = await this.suggestionRepo.findAll();
    const bySlug = new Map(allSuggestions.map((row) => [row.destinationSlug, row]));

    let applied = 0;
    const errors: BulkApplyTaxonomySuggestionsResponse["errors"] = [];

    for (const slug of destinationSlugs) {
      const row = bySlug.get(slug);
      if (!row || row.status !== "pending") {
        errors.push({ destinationSlug: slug, message: "Không còn gợi ý đang chờ duyệt cho điểm này" });
        continue;
      }
      try {
        await this.updateTypes.execute(slug, row.suggestedTypes);
        applied += 1;
      } catch (error) {
        errors.push({
          destinationSlug: slug,
          message: error instanceof Error ? error.message : "Lỗi không xác định",
        });
      }
    }

    return { applied, errors };
  }
}
