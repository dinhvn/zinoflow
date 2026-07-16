import { Inject, Injectable } from "@nestjs/common";
import type { GetDestinationAiExtractionResponse } from "@zinoflow/contracts";
import {
  DESTINATION_AI_EXTRACTION_REPOSITORY,
  type DestinationAiExtractionRepository,
} from "../ports/destination-ai-extraction.repository";

/**
 * Doc dong staging trich xuat AI cho 1 diem den (dichoithoi-destination-ai-
 * extraction-plan §2.1) — extraction=null khi chua tung chay skill cho diem nay.
 */
@Injectable()
export class GetDestinationAiExtractionUseCase {
  constructor(
    @Inject(DESTINATION_AI_EXTRACTION_REPOSITORY)
    private readonly extractionRepo: DestinationAiExtractionRepository,
  ) {}

  async execute(slug: string): Promise<GetDestinationAiExtractionResponse> {
    const record = await this.extractionRepo.findBySlug(slug);
    if (!record) return { extraction: null };
    return {
      extraction: {
        destinationSlug: record.destinationSlug,
        sourceUrls: record.sourceUrls,
        extractedAt: record.extractedAt.toISOString(),
        fields: record.fields,
      },
    };
  }
}
