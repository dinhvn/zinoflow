import type { ArticleType, DraftArticle, QualityCheck } from "@zinoflow/contracts";
import { evaluateAllGates } from "./quality-gates";
import { evaluateDestinationGates } from "./destination-gates";
import type { Article, DestinationArticle } from "@zinoflow/contracts";

/**
 * Chon bo quality gates theo loai bai (spec chinh §19.5):
 * toplist/review -> 4 gates affiliate; guide-diem-den -> 4 gates travel.
 * Ca 2 deu tra ve cung shape QualityCheck[] nen UI/persistence khong doi.
 */
export function evaluateGatesForArticle(input: {
  articleType: ArticleType;
  article: DraftArticle;
  draftMarkdown: string;
  keywordSeed: readonly string[];
}): { checks: QualityCheck[]; allPassed: boolean } {
  if (input.articleType === "guide-diem-den") {
    return evaluateDestinationGates({
      article: input.article as DestinationArticle,
      draftMarkdown: input.draftMarkdown,
      keywordSeed: input.keywordSeed,
    });
  }
  return evaluateAllGates({
    article: input.article as Article,
    draftMarkdown: input.draftMarkdown,
    keywordSeed: input.keywordSeed,
  });
}
