import type { Article, ArticleOutline } from "@zinoflow/contracts";

/**
 * Port persistence cho content draft.
 * Draft hien tai chu yeu la data holder; behavior versioning/review se them o M3
 * (luc do nang len domain entity neu can).
 */
export const CONTENT_DRAFT_REPOSITORY = Symbol("CONTENT_DRAFT_REPOSITORY");

export interface DraftRecord {
  id: string;
  jobId: string;
  version: number;
  title: string | null;
  outline: ArticleOutline | null;
  article: Article | null;
  draftMarkdown: string | null;
  createdAt: Date;
}

export interface ContentDraftRepository {
  save(draft: DraftRecord): Promise<void>;
  findLatestByJobId(jobId: string): Promise<DraftRecord | null>;
}
