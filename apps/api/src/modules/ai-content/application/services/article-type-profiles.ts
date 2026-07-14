import { z } from "zod/v4";
import {
  articleCamNangFrameSchema,
  articleCamNangOutlineSchema,
  articleCamNangSchema,
  articleFrameSchema,
  articleOutlineSchema,
  articleSchema,
  cmsArticleFrameSchema,
  cmsArticleSchema,
  cmsOutlineSchema,
  contentSectionSchema,
  DESTINATION_BLOCK_LABELS,
  DESTINATION_LIST_BLOCK_KEYS,
  DESTINATION_SECTION_ORDER,
  destinationArticleFrameSchema,
  destinationArticleSchema,
  destinationOutlineSchema,
  MIN_LIST_ITEMS,
  type Article,
  type ArticleCamNang,
  type ArticleType,
  type CmsArticle,
  type ContentSection,
  type DestinationArticle,
} from "@zinoflow/contracts";
import { renderArticleMarkdown } from "./article-markdown.renderer";
import { renderDestinationMarkdown } from "./destination-markdown.renderer";
import { renderCmsMarkdown } from "./cms-markdown.renderer";
import { renderCamNangMarkdown } from "./camnang-markdown.renderer";

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
export type AnyArticle = Article | DestinationArticle | CmsArticle | ArticleCamNang;

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
  /**
   * Khung bai KHOI TAO cho draft viet tay (sourceType=Manual) — du field toi
   * thieu de qua schema validate, noi dung la placeholder goi y cau truc,
   * nguoi dung sua lai het qua man edit thong thuong (article-spec §1.1).
   */
  createManualSkeleton(topic: string): AnyArticle;
}

/** Placeholder ro rang de nguoi viet tay biet can thay the — khong bia du lieu that. */
const PLACEHOLDER_NOTE = "[Chưa viết — thay nội dung thật trước khi duyệt]";

/** Dam bao du do dai toi thieu cho cac field title (topic nguoi dung co the ngan hon min) */
function padTitle(topic: string, minLen: number): string {
  return topic.length >= minLen ? topic : topic.padEnd(minLen, " .");
}

const affiliateProfile: ArticleTypeProfile = {
  outlineSchema: articleOutlineSchema as z.ZodType<OutlineLike>,
  sectionSchema: contentSectionSchema,
  frameSchema: articleFrameSchema as unknown as z.ZodType<Record<string, unknown>>,
  assemble: (frame, sections) => articleSchema.parse({ ...frame, sections }),
  renderMarkdown: (article) => renderArticleMarkdown(article as Article),
  extractTitle: (article) => (article as Article).hero.title,
  usesProductCatalog: true,
  createManualSkeleton: (topic) =>
    articleSchema.parse({
      hero: {
        title: padTitle(topic, 10),
        subtitle: PLACEHOLDER_NOTE,
        affiliateDisclosure: "Bài viết có chứa liên kết affiliate — chúng tôi có thể nhận hoa hồng.",
      },
      intent: { forWho: PLACEHOLDER_NOTE, problem: PLACEHOLDER_NOTE },
      quickAnswer: { bullets: [PLACEHOLDER_NOTE, PLACEHOLDER_NOTE, PLACEHOLDER_NOTE] },
      sections: [{ heading: PLACEHOLDER_NOTE, content: PLACEHOLDER_NOTE.repeat(2) }],
      productRecommendations: [
        {
          name: PLACEHOLDER_NOTE,
          whyInList: PLACEHOLDER_NOTE,
          pros: [PLACEHOLDER_NOTE],
          cons: [PLACEHOLDER_NOTE],
          priceRange: PLACEHOLDER_NOTE,
          bestFor: PLACEHOLDER_NOTE,
          productUrl: "https://example.com/thay-link-that",
        },
      ],
      faq: [
        { question: PLACEHOLDER_NOTE, answer: PLACEHOLDER_NOTE },
        { question: PLACEHOLDER_NOTE, answer: PLACEHOLDER_NOTE },
        { question: PLACEHOLDER_NOTE, answer: PLACEHOLDER_NOTE },
      ],
      finalCta: { text: PLACEHOLDER_NOTE, action: PLACEHOLDER_NOTE },
      metadata: {
        metaTitle: topic.slice(0, 70).padEnd(10, "."),
        metaDescription: PLACEHOLDER_NOTE.repeat(3).slice(0, 170),
        slug: "bai-viet-tay",
        internalLinkSuggestions: [PLACEHOLDER_NOTE, PLACEHOLDER_NOTE],
      },
    }),
};

const destinationProfile: ArticleTypeProfile = {
  outlineSchema: destinationOutlineSchema as z.ZodType<OutlineLike>,
  sectionSchema: contentSectionSchema,
  frameSchema: destinationArticleFrameSchema as unknown as z.ZodType<Record<string, unknown>>,
  assemble: (frame, sections) => destinationArticleSchema.parse({ ...frame, sections }),
  renderMarkdown: (article) => renderDestinationMarkdown(article as DestinationArticle),
  extractTitle: (article) => (article as DestinationArticle).title,
  usesProductCatalog: false,
  createManualSkeleton: (topic) =>
    destinationArticleSchema.parse({
      title: padTitle(topic, 10),
      intro: PLACEHOLDER_NOTE.repeat(2),
      quickFacts: {
        openingTime: PLACEHOLDER_NOTE,
        ticketPrice: PLACEHOLDER_NOTE,
        transport: PLACEHOLDER_NOTE,
        food: PLACEHOLDER_NOTE,
        hotel: PLACEHOLDER_NOTE,
        tip: PLACEHOLDER_NOTE,
      },
      faq: [
        { question: PLACEHOLDER_NOTE, answer: PLACEHOLDER_NOTE },
        { question: PLACEHOLDER_NOTE, answer: PLACEHOLDER_NOTE },
        { question: PLACEHOLDER_NOTE, answer: PLACEHOLDER_NOTE },
      ],
      updateNotice: PLACEHOLDER_NOTE,
      metadata: {
        name: topic,
        slugSuggestion: "bai-viet-tay",
        metaTitle: topic.slice(0, 60).padEnd(10, "."),
        metaDescription: PLACEHOLDER_NOTE.repeat(4).slice(0, 250),
        description: PLACEHOLDER_NOTE.repeat(4).slice(0, 250),
        searchKeyword: topic,
      },
      sections: DESTINATION_SECTION_ORDER.map((blockKey) =>
        DESTINATION_LIST_BLOCK_KEYS.includes(blockKey)
          ? {
              heading: DESTINATION_BLOCK_LABELS[blockKey],
              content: PLACEHOLDER_NOTE.repeat(2),
              blockKey,
              items: Array.from({ length: MIN_LIST_ITEMS }, () => ({
                ten: PLACEHOLDER_NOTE,
                moTa: PLACEHOLDER_NOTE,
              })),
            }
          : { heading: DESTINATION_BLOCK_LABELS[blockKey], content: PLACEHOLDER_NOTE.repeat(2), blockKey },
      ),
    }),
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
  createManualSkeleton: (topic) =>
    cmsArticleSchema.parse({
      title: padTitle(topic, 10),
      excerpt: PLACEHOLDER_NOTE.repeat(2),
      sections: [
        { heading: PLACEHOLDER_NOTE, content: PLACEHOLDER_NOTE.repeat(2) },
        { heading: PLACEHOLDER_NOTE, content: PLACEHOLDER_NOTE.repeat(2) },
      ],
    }),
};

/**
 * Bai tong hop / cam nang (dichoithoi-article-spec.md) — sections co the chua
 * khoi dong [[block:...]] tren 1 dong rieng, compile thanh HTML luc publish
 * (apps/api/src/modules/article). Khong dung product catalog.
 */
const camNangProfile: ArticleTypeProfile = {
  outlineSchema: articleCamNangOutlineSchema as z.ZodType<OutlineLike>,
  sectionSchema: contentSectionSchema,
  frameSchema: articleCamNangFrameSchema as unknown as z.ZodType<Record<string, unknown>>,
  assemble: (frame, sections) => articleCamNangSchema.parse({ ...frame, sections }),
  renderMarkdown: (article) => renderCamNangMarkdown(article as ArticleCamNang),
  extractTitle: (article) => (article as ArticleCamNang).title,
  usesProductCatalog: false,
  createManualSkeleton: (topic) =>
    articleCamNangSchema.parse({
      title: padTitle(topic, 10),
      intro: PLACEHOLDER_NOTE.repeat(2),
      metadata: {
        metaTitle: topic.slice(0, 60).padEnd(10, "."),
        metaDescription: PLACEHOLDER_NOTE.repeat(4).slice(0, 250),
        slugSuggestion: "bai-cam-nang-tay",
        searchKeyword: topic,
      },
      sections: [
        {
          heading: PLACEHOLDER_NOTE,
          content:
            `${PLACEHOLDER_NOTE}\n\n` +
            "<!-- Gợi ý: chèn khối động ở đây, vd [[block:destinations type=thac-ho-suoi limit=6]] -->",
        },
      ],
    }),
};

const PROFILES: Record<string, ArticleTypeProfile> = {
  toplist: affiliateProfile,
  review: affiliateProfile,
  "guide-diem-den": destinationProfile,
  "cam-nang": camNangProfile,
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
