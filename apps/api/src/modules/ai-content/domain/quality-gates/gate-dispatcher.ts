import type {
  ArticleType,
  DraftArticle,
  QualityCheck,
} from "@zinoflow/contracts";
import { evaluateAllGates } from "./quality-gates";
import { evaluateDestinationGates } from "./destination-gates";
import { evaluateArticleCamNangGates } from "./article-camnang-gates";
import {
  evaluateDestinationOriginalityGate,
  type SimilarDestinationExcerpt,
} from "./originality-gate";
import type {
  Article,
  ArticleCamNang,
  DestinationArticle,
} from "@zinoflow/contracts";

/**
 * Chon bo quality gates theo loai bai (spec chinh §19.5):
 * toplist/review -> 4 gates affiliate; guide-diem-den -> 4 gates travel (+ gate
 * "originality" khi co du lieu so sanh, 07/2026); cam-nang -> 2 gates khoi dong
 * (dichoithoi-article-spec.md §6). Ca 3 deu tra ve cung shape QualityCheck[]
 * nen UI/persistence khong doi.
 */
export function evaluateGatesForArticle(input: {
  articleType: ArticleType;
  article: DraftArticle;
  draftMarkdown: string;
  keywordSeed: readonly string[];
  /** Chi dung khi articleType=guide-diem-den (Phase 28.3) — doi gate cau chuyen van hoa->mua/thoi diem */
  contentTier?: "flagship" | "standard" | null;
  /**
   * Ket qua so sanh trigram voi bai KHAC cung tinh (07/2026) — do usecase tu
   * query san (IOriginalityCorpusRepository) roi truyen vao, gate KHONG tu
   * query. undefined = bo qua han gate nay (vd chua co comparisonKey).
   * allPassed KHONG bi anh huong boi gate nay (luon severity="warning").
   */
  originalitySimilarTo?: readonly SimilarDestinationExcerpt[];
  sourceContext?: string | null;
}): { checks: QualityCheck[]; allPassed: boolean } {
  if (input.articleType === "guide-diem-den") {
    const result = evaluateDestinationGates({
      article: input.article as DestinationArticle,
      draftMarkdown: input.draftMarkdown,
      keywordSeed: input.keywordSeed,
      contentTier: input.contentTier,
      sourceContext: input.sourceContext,
    });
    if (input.originalitySimilarTo !== undefined) {
      const originalityCheck = evaluateDestinationOriginalityGate({
        similarTo: input.originalitySimilarTo,
      });
      return {
        checks: [...result.checks, originalityCheck],
        allPassed: result.allPassed,
      };
    }
    return result;
  }
  if (input.articleType === "cam-nang") {
    return evaluateArticleCamNangGates({
      article: input.article as ArticleCamNang,
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
