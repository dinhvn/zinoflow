/**
 * Port repository bang `dichoithoi_taxonomy_suggestions` (relations-plan §6.3).
 * Implementation: infrastructure/repositories/typeorm-taxonomy-suggestion.repository.ts.
 */
export const TAXONOMY_SUGGESTION_REPOSITORY = Symbol("TAXONOMY_SUGGESTION_REPOSITORY");

export interface TaxonomySuggestionRow {
  destinationSlug: string;
  suggestedTypes: string[];
  reason: string;
  status: "pending" | "accepted" | "rejected";
}

export interface TaxonomySuggestionRepository {
  findAll(): Promise<TaxonomySuggestionRow[]>;
  /** Upsert theo destinationSlug (ghi de neu chay lai cho cung 1 diem) */
  upsertMany(rows: readonly Omit<TaxonomySuggestionRow, "status">[]): Promise<void>;
  /** Nguoi dung da xu ly (luu that vao v2.DestinationTypeMap) — khong de xuat lai lan sau */
  markAccepted(destinationSlug: string): Promise<void>;
}
