export const ARTICLE_PUBLICATION_REPOSITORY = Symbol("ARTICLE_PUBLICATION_REPOSITORY");

export interface ArticlePublicationRecord {
  jobId: string;
  siteId: number;
  slug: string;
  publishedAt: Date;
  lastRefreshedAt: Date | null;
}

export interface ArticlePublicationRepository {
  findByJobId(jobId: string): Promise<ArticlePublicationRecord | null>;
  findBySlug(slug: string): Promise<ArticlePublicationRecord | null>;
  upsert(record: Omit<ArticlePublicationRecord, "lastRefreshedAt">): Promise<void>;
  markRefreshed(jobId: string, at: Date): Promise<void>;
  listAll(): Promise<ArticlePublicationRecord[]>;
}
