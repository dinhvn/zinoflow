import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ContentSection } from "@zinoflow/contracts";
import type { AnyArticle, ArticleTypeProfile, OutlineLike } from "./article-type-profiles";
import {
  CONTENT_DRAFT_REPOSITORY,
  type ContentDraftRepository,
} from "../ports/content-draft.repository";

/**
 * Ap ket qua content AI tho (rawArticle) thanh bai hoan chinh — normalize
 * section + article theo profile. Ham thuan (khong side effect), dung chung
 * cho luong sync (GenerateContentUseCase) va batch (ContentArticleBatchTaskHandler).
 */
export function finalizeArticle(
  rawArticle: AnyArticle,
  profile: ArticleTypeProfile,
  outline: OutlineLike,
  sourceContext: string | null,
): AnyArticle {
  const sections = (rawArticle as { sections: ContentSection[] }).sections;
  const normalizedSections = profile.normalizeSection
    ? sections.map((s, i) => profile.normalizeSection!(s, i, outline))
    : sections;
  const articleWithNormalizedSections = {
    ...rawArticle,
    sections: normalizedSections,
  } as AnyArticle;
  return profile.normalizeArticle
    ? profile.normalizeArticle(articleWithNormalizedSections, sourceContext)
    : articleWithNormalizedSections;
}

/**
 * Luu 1 version draft moi cho job — dung chung cho luong sync va batch.
 * Tach thanh injectable (can ContentDraftRepository qua DI) thay vi ham
 * thuan vi phai doc version moi nhat truoc khi ghi.
 */
@Injectable()
export class ContentDraftPersister {
  constructor(
    @Inject(CONTENT_DRAFT_REPOSITORY) private readonly drafts: ContentDraftRepository,
  ) {}

  async saveNewVersion(
    jobId: string,
    profile: ArticleTypeProfile,
    outline: OutlineLike,
    article: AnyArticle,
  ): Promise<void> {
    const latest = await this.drafts.findLatestByJobId(jobId);
    await this.drafts.save({
      id: randomUUID(),
      jobId,
      version: (latest?.version ?? 0) + 1, // generate lai -> version moi, khong de unique conflict
      title: profile.extractTitle(article),
      outline: outline as { title: string; sectionHeadings: string[] } & Record<string, unknown>,
      article,
      draftMarkdown: profile.renderMarkdown(article),
      createdAt: new Date(),
    });
  }
}
