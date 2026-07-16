import type { DestinationAiExtractionFieldItem } from "@zinoflow/contracts";

/**
 * Port repository bang staging trich xuat AI (dichoithoi-destination-ai-extraction-plan
 * §2.1). Implementation: infrastructure/repositories/typeorm-destination-ai-extraction.repository.ts.
 */
export const DESTINATION_AI_EXTRACTION_REPOSITORY = Symbol(
  "DESTINATION_AI_EXTRACTION_REPOSITORY",
);

export interface DestinationAiExtractionRecord {
  destinationSlug: string;
  sourceUrls: string[];
  extractedAt: Date;
  fields: DestinationAiExtractionFieldItem[];
}

export interface DestinationAiExtractionRepository {
  findBySlug(slug: string): Promise<DestinationAiExtractionRecord | null>;
  /** Ghi de nguyen mang `fields` (dung sau khi doi status cac phan tu da Chap nhan) */
  updateFields(slug: string, fields: DestinationAiExtractionFieldItem[]): Promise<void>;
}
