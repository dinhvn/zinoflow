import { z } from "zod/v4";
import {
  articleFrameSchema,
  articleOutlineSchema,
  articleSchema,
  contentSectionSchema,
  destinationArticleFrameSchema,
  destinationArticleSchema,
  destinationOutlineSchema,
  type Article,
  type ArticleType,
  type ContentSection,
  type DestinationArticle,
} from "@zinoflow/contracts";
import { renderArticleMarkdown } from "./article-markdown.renderer";
import { renderDestinationMarkdown } from "./destination-markdown.renderer";

/**
 * Content Type registry (spec chinh §19.3): moi articleType khai bao bo schema
 * + cach assemble + render — them loai bai moi = them 1 profile, KHONG sua
 * core flow generate 3 buoc.
 */

/** Phan toi thieu cua outline ma pipeline can de chay buoc 2 (expand section). */
export interface OutlineLike {
  title: string;
  sectionHeadings: string[];
}

/** Bai viet cua bat ky loai nao — luu jsonb trong content_drafts.article. */
export type AnyArticle = Article | DestinationArticle;

export interface ArticleTypeProfile {
  /** Schema buoc 1 — phai chua title + sectionHeadings */
  outlineSchema: z.ZodType<OutlineLike>;
  /** Schema buoc 2 — 1 section */
  sectionSchema: typeof contentSectionSchema;
  /** Schema buoc 3 — toan bai tru sections */
  frameSchema: z.ZodType<Record<string, unknown>>;
  /** Ghep frame + sections va validate bang schema toan bai (nguon su that cuoi) */
  assemble(frame: Record<string, unknown>, sections: ContentSection[]): AnyArticle;
  renderMarkdown(article: AnyArticle): string;
  /** Title de luu vao draft record */
  extractTitle(article: AnyArticle): string;
  /** Bai affiliate can product data tu catalog; bai diem den thi khong */
  usesProductCatalog: boolean;
}

const affiliateProfile: ArticleTypeProfile = {
  outlineSchema: articleOutlineSchema as z.ZodType<OutlineLike>,
  sectionSchema: contentSectionSchema,
  frameSchema: articleFrameSchema as unknown as z.ZodType<Record<string, unknown>>,
  assemble: (frame, sections) => articleSchema.parse({ ...frame, sections }),
  renderMarkdown: (article) => renderArticleMarkdown(article as Article),
  extractTitle: (article) => (article as Article).hero.title,
  usesProductCatalog: true,
};

const destinationProfile: ArticleTypeProfile = {
  outlineSchema: destinationOutlineSchema as z.ZodType<OutlineLike>,
  sectionSchema: contentSectionSchema,
  frameSchema: destinationArticleFrameSchema as unknown as z.ZodType<Record<string, unknown>>,
  assemble: (frame, sections) => destinationArticleSchema.parse({ ...frame, sections }),
  renderMarkdown: (article) => renderDestinationMarkdown(article as DestinationArticle),
  extractTitle: (article) => (article as DestinationArticle).title,
  usesProductCatalog: false,
};

const PROFILES: Record<ArticleType, ArticleTypeProfile> = {
  toplist: affiliateProfile,
  review: affiliateProfile,
  "guide-diem-den": destinationProfile,
};

export function getArticleTypeProfile(articleType: ArticleType): ArticleTypeProfile {
  return PROFILES[articleType];
}

/** Type guard cho UI/gates: bai nay co phai bai diem den khong. */
export function isDestinationArticle(
  articleType: ArticleType,
  article: AnyArticle,
): article is DestinationArticle {
  return articleType === "guide-diem-den" && "quickFacts" in article;
}
