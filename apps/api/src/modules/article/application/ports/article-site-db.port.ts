export const ARTICLE_SITE_DB = Symbol("ARTICLE_SITE_DB");

export interface UpsertArticleInput {
  siteId: number | null;
  slug: string;
  title: string;
  shortDescription: string | null;
  thumbnail: string | null;
  contentHtml: string;
  metaTitle: string | null;
  metaDescription: string | null;
}

/** Adapter SQL Server cho v2.Article (article-spec §8) — moi hoan toan, chi luu ContentHtml da compile */
export interface ArticleSiteDb {
  isConfigured(): boolean;
  upsertArticle(input: UpsertArticleInput): Promise<{ siteId: number }>;
  /** "Lam moi khoi dong" — ghi de rieng ContentHtml, khong dong den metadata */
  updateContentHtml(siteId: number, contentHtml: string): Promise<void>;
}
