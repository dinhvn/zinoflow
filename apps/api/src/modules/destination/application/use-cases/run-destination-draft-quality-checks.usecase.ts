import { Inject, Injectable } from "@nestjs/common";
import type { DestinationDraftQualityChecksResponse } from "@zinoflow/contracts";
import { DomainRuleError } from "../../../shared/errors/app-error";
import {
  DESTINATION_MIRROR_REPOSITORY,
  type DestinationMirrorRepository,
} from "../ports/destination-mirror.repository";
import { evaluateGatesForArticle } from "../../../ai-content/domain/quality-gates/gate-dispatcher";
import { renderDestinationMarkdown } from "../../../ai-content/application/services/destination-markdown.renderer";
import { parseDraftArticleOrThrow } from "../services/parse-draft-article";

/**
 * Chay 4 gate (structure/seo/policy/data) tren draft_article HIEN TAI cua 1 diem
 * den, DOC LAP voi draftId/job — pivot gop editor vao trang detail. FE goi truoc
 * khi bam Publish de hien checklist ro rang (khong con bat buoc Approve rieng).
 */
@Injectable()
export class RunDestinationDraftQualityChecksUseCase {
  constructor(
    @Inject(DESTINATION_MIRROR_REPOSITORY)
    private readonly mirrorRepo: DestinationMirrorRepository,
  ) {}

  async execute(slug: string): Promise<DestinationDraftQualityChecksResponse> {
    const destination = await this.mirrorRepo.findBySlug(slug);
    if (!destination) {
      throw new DomainRuleError(`Không tìm thấy điểm đến "${slug}" trong mirror`);
    }
    const article = parseDraftArticleOrThrow(destination.draftArticle, destination.name);
    const draftMarkdown = renderDestinationMarkdown(article);

    const { checks, allPassed } = evaluateGatesForArticle({
      articleType: "guide-diem-den",
      article,
      draftMarkdown,
      keywordSeed: [destination.name],
      contentTier: destination.contentTier,
    });
    return { checks, allPassed };
  }
}
