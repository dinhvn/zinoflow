import type { SimilarDestinationExcerpt } from "../../domain/quality-gates/originality-gate";

/**
 * Port doc corpus so sanh cho gate "originality" — CHI dung du lieu cua chinh
 * module ai-content (content_jobs.comparison_key/originality_excerpt), khong
 * reach sang module destination (giu ranh gioi clean architecture).
 */
export const ORIGINALITY_CORPUS_REPOSITORY = Symbol("ORIGINALITY_CORPUS_REPOSITORY");

export interface OriginalityCorpusRepository {
  /**
   * Tra ve top N job KHAC (cung comparisonKey + articleType, da Approved, co
   * originality_excerpt) kem diem similarity (pg_trgm) so voi `excerpt`.
   */
  findSimilar(params: {
    excerpt: string;
    comparisonKey: string;
    articleType: string;
    excludeJobId: string;
  }): Promise<SimilarDestinationExcerpt[]>;
}
