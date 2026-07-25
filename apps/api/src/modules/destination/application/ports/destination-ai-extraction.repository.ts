import type { DestinationAiExtractionFieldItem, DestinationAiExtractionSource } from "@zinoflow/contracts";

/**
 * Port repository bang staging trich xuat AI (dichoithoi-destination-ai-extraction-plan
 * §2.1, §6 A1/A3 — PK composite destination_slug+source).
 * Implementation: infrastructure/repositories/typeorm-destination-ai-extraction.repository.ts.
 */
export const DESTINATION_AI_EXTRACTION_REPOSITORY = Symbol(
  "DESTINATION_AI_EXTRACTION_REPOSITORY",
);

export interface DestinationAiExtractionRecord {
  destinationSlug: string;
  source: DestinationAiExtractionSource;
  sourceUrls: string[];
  extractedAt: Date;
  fields: DestinationAiExtractionFieldItem[];
}

export interface DestinationAiExtractionRepository {
  findBySlugAndSource(
    slug: string,
    source: DestinationAiExtractionSource,
  ): Promise<DestinationAiExtractionRecord | null>;
  /** Toi da 2 dong (skill + gsg) — dung cho man xem/so sanh (§6 C1) */
  findAllBySlug(slug: string): Promise<DestinationAiExtractionRecord[]>;
  /** Ghi de nguyen mang `fields` cua DUNG 1 nguon (dung sau khi doi status cac phan tu da Chap nhan) */
  updateFields(
    slug: string,
    source: DestinationAiExtractionSource,
    fields: DestinationAiExtractionFieldItem[],
  ): Promise<void>;
  /** Upsert 1 dong (dung boi ca script CLI skill lan use case backend gsg qua ham dedupe chung, §6 A4) */
  upsert(record: DestinationAiExtractionRecord): Promise<void>;
}
