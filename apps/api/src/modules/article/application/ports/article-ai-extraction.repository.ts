import type { ArticleAiExtractionSource } from "@zinoflow/contracts";

export const ARTICLE_AI_EXTRACTION_REPOSITORY = Symbol("ARTICLE_AI_EXTRACTION_REPOSITORY");

export interface ArticleAiExtractionRecord {
  jobId: string;
  source: ArticleAiExtractionSource;
  sourceUrls: string[];
  extractedSummary: string;
  extractedAt: Date;
}

export interface ArticleAiExtractionRepository {
  findByJobId(jobId: string): Promise<ArticleAiExtractionRecord[]>;
  upsert(record: ArticleAiExtractionRecord): Promise<void>;
}
