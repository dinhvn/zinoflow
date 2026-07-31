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
  /** Danh muc bai cam nang — loc/hien thi /cam-nang/danh-muc (chot 31/07/2026). */
  category: string | null;
}

/** 1 dong gan diem den + topic cho bai (article-spec §8.1, Phase 26) */
export interface ArticleDestinationMapRow {
  destinationSlug: string;
  topic: string;
  order: number;
}

/** Adapter SQL Server cho v2.Article (article-spec §8) — moi hoan toan, chi luu ContentHtml da compile */
export interface ArticleSiteDb {
  isConfigured(): boolean;
  upsertArticle(input: UpsertArticleInput): Promise<{ siteId: number }>;
  /** "Lam moi khoi dong" — ghi de rieng ContentHtml, khong dong den metadata */
  updateContentHtml(siteId: number, contentHtml: string): Promise<void>;
  /** Doc gan ket dien den hien tai cua 1 bai (article-spec §8.1) */
  fetchDestinationMap(articleId: number): Promise<ArticleDestinationMapRow[]>;
  /** Ghi de TOAN BO gan ket — xoa dong cu, insert lai theo items moi (bo qua slug khong ton tai) */
  replaceDestinationMap(
    articleId: number,
    items: readonly ArticleDestinationMapRow[],
  ): Promise<void>;
}
