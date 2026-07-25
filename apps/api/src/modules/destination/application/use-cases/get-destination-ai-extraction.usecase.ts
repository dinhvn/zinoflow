import { Inject, Injectable } from "@nestjs/common";
import type { GetDestinationAiExtractionResponse } from "@zinoflow/contracts";
import {
  DESTINATION_AI_EXTRACTION_REPOSITORY,
  type DestinationAiExtractionRepository,
} from "../ports/destination-ai-extraction.repository";

/**
 * Doc TOAN BO dong staging trich xuat AI cho 1 diem den (dichoithoi-destination-ai-
 * extraction-plan §2.1, §6 A3/C1) — toi da 2 dong (source="skill"/"gsg"). Mang rong
 * = chua tung trich xuat nguon nao cho diem nay.
 */
@Injectable()
export class GetDestinationAiExtractionUseCase {
  constructor(
    @Inject(DESTINATION_AI_EXTRACTION_REPOSITORY)
    private readonly extractionRepo: DestinationAiExtractionRepository,
  ) {}

  async execute(slug: string): Promise<GetDestinationAiExtractionResponse> {
    const records = await this.extractionRepo.findAllBySlug(slug);
    return {
      extractions: records.map((record) => ({
        destinationSlug: record.destinationSlug,
        source: record.source,
        sourceUrls: record.sourceUrls,
        extractedAt: record.extractedAt.toISOString(),
        fields: record.fields,
      })),
    };
  }
}
