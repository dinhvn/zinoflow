import { Inject, Injectable } from "@nestjs/common";
import type { ListArticleAiExtractionsResponse } from "@zinoflow/contracts";
import {
  ARTICLE_AI_EXTRACTION_REPOSITORY,
  type ArticleAiExtractionRepository,
} from "../ports/article-ai-extraction.repository";

/** Doc trich xuat nguon hien co cua 1 job (skill + gsg) — article-ai-extraction-plan.md GĐ2. */
@Injectable()
export class GetArticleAiExtractionUseCase {
  constructor(
    @Inject(ARTICLE_AI_EXTRACTION_REPOSITORY)
    private readonly extractions: ArticleAiExtractionRepository,
  ) {}

  async execute(jobId: string): Promise<ListArticleAiExtractionsResponse> {
    const rows = await this.extractions.findByJobId(jobId);
    return {
      items: rows.map((r) => ({
        jobId: r.jobId,
        source: r.source,
        sourceUrls: r.sourceUrls,
        extractedSummary: r.extractedSummary,
        extractedAt: r.extractedAt.toISOString(),
      })),
    };
  }
}
