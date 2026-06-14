import { z } from "zod/v4";
import {
  articleFrameSchema,
  articleOutlineSchema,
  articleSchema,
  cmsArticleFrameSchema,
  cmsArticleSchema,
  cmsOutlineSchema,
  contentSectionSchema,
  destinationArticleFrameSchema,
  destinationArticleSchema,
  destinationOutlineSchema,
  type Article,
  type ArticleType,
  type CmsArticle,
  type ContentSection,
  type DestinationArticle,
} from "@zinoflow/contracts";
import { renderArticleMarkdown } from "./article-markdown.renderer";
import { renderDestinationMarkdown } from "./destination-markdown.renderer";
import { renderCmsMarkdown } from "./cms-markdown.renderer";

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
export type AnyArticle = Article | DestinationArticle | CmsArticle;

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

/** Bai CMS khuyenmai (km-*) — 1 content, prompt khac theo site x postType (resolve o prompt-builder). */
const cmsProfile: ArticleTypeProfile = {
  outlineSchema: cmsOutlineSchema as z.ZodType<OutlineLike>,
  sectionSchema: contentSectionSchema,
  frameSchema: cmsArticleFrameSchema as unknown as z.ZodType<Record<string, unknown>>,
  assemble: (frame, sections) => cmsArticleSchema.parse({ ...frame, sections }),
  renderMarkdown: (article) => renderCmsMarkdown(article as CmsArticle),
  extractTitle: (article) => (article as CmsArticle).title,
  usesProductCatalog: false,
};

const PROFILES: Record<string, ArticleTypeProfile> = {
  toplist: affiliateProfile,
  review: affiliateProfile,
  "guide-diem-den": destinationProfile,
};

export function getArticleTypeProfile(articleType: ArticleType): ArticleTypeProfile {
  // Moi articleType km-<postType> dung chung cmsProfile (output schema giong nhau);
  // khac biet nam o PROMPT (site x postType) resolve trong prompt-builder.
  if (articleType.startsWith("km-")) return cmsProfile;
  const profile = PROFILES[articleType];
  if (!profile) throw new Error(`Khong co profile cho articleType "${articleType}"`);
  return profile;
}

/** Type guard cho UI/gates: bai nay co phai bai diem den khong. */
export function isDestinationArticle(
  articleType: ArticleType,
  article: AnyArticle,
): article is DestinationArticle {
  return articleType === "guide-diem-den" && "quickFacts" in article;
}
