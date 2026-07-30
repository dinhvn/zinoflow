import { z } from "zod/v4";
import {
  articleCamNangOutlineSchema,
  articleCamNangSchema,
  articleOutlineSchema,
  articleSchema,
  cmsArticleSchema,
  cmsOutlineSchema,
  contentSectionSchema,
  DESTINATION_BLOCK_LABELS,
  DESTINATION_LIST_BLOCK_KEYS,
  DESTINATION_SECTION_ORDER,
  destinationArticleSchema,
  destinationOutlineSchema,
  destinationSectionSchema,
  MIN_LIST_ITEMS,
  type Article,
  type ArticleCamNang,
  type ArticleType,
  type CmsArticle,
  type ContentSection,
  type DestinationArticle,
  type DestinationBlockKey,
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
export type AnyArticle =
  | Article
  | DestinationArticle
  | CmsArticle
  | ArticleCamNang;

export interface ArticleTypeProfile {
  /** Schema buoc 1 — phai chua title + sectionHeadings */
  outlineSchema: z.ZodType<OutlineLike>;
  /**
   * Schema cho goi y 1 khoi rieng le (nut "Tạo lại bằng AI" tung block,
   * generate-destination-block.usecase.ts) — KHONG con dung trong pipeline
   * generate chinh (buoc 2 da gop section+frame lam 1, Option 3 09/2026,
   * xem generate-content.usecase.ts).
   */
  sectionSchema: z.ZodType<ContentSection>;
  /**
   * Schema buoc 2 — TOAN BO bai (moi section + frame: intro/quickFacts/faq/
   * metadata...) trong 1 lan goi AI duy nhat. Cung la schema validate cuoi
   * cung — khong can buoc assemble rieng nua vi provider.generateStructured()
   * da tu validate output bang chinh schema nay truoc khi tra ve.
   */
  contentSchema: z.ZodType<AnyArticle>;
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
  /**
   * Sua outline AI tra ve TRUOC KHI dung cho buoc 2 (tuy chon, mac dinh giu nguyen).
   * Bai diem den luon co 7 chu de CO DINH theo DUNG THU TU (DESTINATION_SECTION_ORDER)
   * — AI de bi lac de (vd viet "meo nho"/"diem lan can" thay vi "an gi"/"qua mang ve",
   * bug phat hien 07/2026: 3/7 khoi bi bo, section bi gan blockKey sai/trung). Thay vi
   * tin AI tu dat dung 7 tieu de, ep cung sectionHeadings theo template co dinh — AI
   * chi con viet NOI DUNG dung chu de duoc giao, khong con co hoi lac de o buoc nay.
   */
  normalizeOutline?(outline: OutlineLike, topic: string): OutlineLike;
  /**
   * Sua 1 section AI tra ve TRUOC KHI dua vao mang sections (tuy chon). Bai diem den
   * ep cung blockKey theo DUNG VI TRI trong DESTINATION_SECTION_ORDER — khong tin AI
   * tu gan lai blockKey (cung nguyen tac da dung o GenerateDestinationBlockUseCase),
   * tranh truong hop AI gan sai/trung blockKey khi noi dung headings da bi ep dung roi.
   */
  normalizeSection?(section: ContentSection, index: number): ContentSection;
  /** Ap dung invariant phu thuoc nguon sau khi AI tra ve toan bai. */
  normalizeArticle?(
    article: AnyArticle,
    sourceContext: string | null,
  ): AnyArticle;
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
  contentSchema: articleSchema as unknown as z.ZodType<AnyArticle>,
  renderMarkdown: (article) => renderArticleMarkdown(article as Article),
  extractTitle: (article) => (article as Article).hero.title,
  usesProductCatalog: true,
  createManualSkeleton: (topic) =>
    articleSchema.parse({
      hero: {
        title: padTitle(topic, 10),
        subtitle: PLACEHOLDER_NOTE,
        affiliateDisclosure:
          "Bài viết có chứa liên kết affiliate — chúng tôi có thể nhận hoa hồng.",
      },
      intent: { forWho: PLACEHOLDER_NOTE, problem: PLACEHOLDER_NOTE },
      quickAnswer: {
        bullets: [PLACEHOLDER_NOTE, PLACEHOLDER_NOTE, PLACEHOLDER_NOTE],
      },
      sections: [
        { heading: PLACEHOLDER_NOTE, content: PLACEHOLDER_NOTE.repeat(2) },
      ],
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

/**
 * Tieu de mau cho dung 7 chu de co dinh (DESTINATION_SECTION_ORDER) — khop dung
 * template da mo ta trong prompt outline (default-prompts.ts, muc "guide-diem-den"/
 * "guide-diem-den-flagship"). Dung de EP CUNG sectionHeadings sau khi AI tra ve, thay
 * vi tin AI tu dat dung 7 tieu de theo dung thu tu (bug 07/2026: AI de lac de, bo qua
 * "lich-trinh"/"an-gi"/"qua-mang-ve" de thay bang chu de tuy hung khac).
 */
const DESTINATION_HEADING_TEMPLATES: Partial<
  Record<DestinationBlockKey, (topic: string) => string>
> = {
  "tong-quan": (topic) => `Tổng quan / giới thiệu về ${topic}`,
  "trai-nghiem": (topic) => `Trải nghiệm gì ở ${topic}`,
  "mua-nao": (topic) => `Nên đi ${topic} vào mùa nào`,
  "lich-trinh": (topic) => `Lịch trình gợi ý khi đi ${topic}`,
  "di-chuyen": (topic) => `Di chuyển tới ${topic}`,
  "an-gi": (topic) => `Ăn gì đặc trưng ở ${topic}`,
  "qua-mang-ve": (topic) => `Quà mang về từ ${topic}`,
};

const MISSING_SOURCE_LIST_BLOCKS: ReadonlyArray<
  readonly [string, DestinationBlockKey]
> = [
  ["activities", "trai-nghiem"],
  ["food", "an-gi"],
  ["souvenirs", "qua-mang-ve"],
];

const MISSING_SOURCE_BLOCK_CONTENT: Partial<
  Record<DestinationBlockKey, string>
> = {
  "trai-nghiem":
    "Hiện chưa có dữ liệu đã xác minh về các hoạt động cụ thể tại điểm đến.",
  "an-gi": "Hiện chưa có dữ liệu đã xác minh về dịch vụ ăn uống tại điểm đến.",
  "qua-mang-ve":
    "Hiện chưa có dữ liệu đã xác minh về quà lưu niệm hoặc đặc sản bán tại điểm đến.",
};

const MISSING_SOURCE_FAQ_PATTERNS: Partial<
  Record<DestinationBlockKey, RegExp>
> = {
  "trai-nghiem": /dịch vụ|cho thuê|cứu hộ|chuẩn bị|tiện ích/i,
  "an-gi": /ăn uống|thực phẩm|nước uống|hàng quán|nhà hàng|quán ăn/i,
  "qua-mang-ve": /quà|lưu niệm|đặc sản|mua sắm/i,
};

function normalizeDestinationArticle(
  article: DestinationArticle,
  sourceContext: string | null,
): DestinationArticle {
  const blocksWithoutSource = new Set(
    MISSING_SOURCE_LIST_BLOCKS.filter(([flag]) =>
      sourceContext?.includes(`- ${flag}: missing-structured-source`),
    ).map(([, blockKey]) => blockKey),
  );
  if (blocksWithoutSource.size === 0) return article;

  const unsupportedFaqPatterns = [...blocksWithoutSource]
    .map((blockKey) => MISSING_SOURCE_FAQ_PATTERNS[blockKey])
    .filter((pattern): pattern is RegExp => pattern !== undefined);

  return {
    ...article,
    quickFacts: blocksWithoutSource.has("an-gi")
      ? { ...article.quickFacts, food: MISSING_SOURCE_BLOCK_CONTENT["an-gi"]! }
      : article.quickFacts,
    sections: article.sections.map((section) =>
      section.blockKey && blocksWithoutSource.has(section.blockKey)
        ? {
            ...section,
            content: MISSING_SOURCE_BLOCK_CONTENT[section.blockKey]!,
            items: [],
          }
        : section,
    ),
    faq: article.faq.filter((item) => {
      const faqText = `${item.question} ${item.answer}`;
      return unsupportedFaqPatterns.every((pattern) => !pattern.test(faqText));
    }),
  };
}

const destinationProfile: ArticleTypeProfile = {
  outlineSchema: destinationOutlineSchema as z.ZodType<OutlineLike>,
  // Section schema RIENG (khac 3 profile con lai) — gioi han blockKey dung 7 gia
  // tri hien hanh, tranh AI chon nham gia tri legacy "meo-luu-y"/"khac" (van hop
  // le trong contentSectionSchema dung chung) khien section bi loc mat khoi UI
  // duyet (bug 07/2026, xem ghi chu o destinationSectionSchema).
  sectionSchema: destinationSectionSchema,
  contentSchema: destinationArticleSchema as unknown as z.ZodType<AnyArticle>,
  renderMarkdown: (article) =>
    renderDestinationMarkdown(article as DestinationArticle),
  extractTitle: (article) => (article as DestinationArticle).title,
  usesProductCatalog: false,
  normalizeOutline: (outline, topic) => ({
    ...outline,
    sectionHeadings: DESTINATION_SECTION_ORDER.map(
      (key) =>
        DESTINATION_HEADING_TEMPLATES[key]?.(topic) ??
        DESTINATION_BLOCK_LABELS[key],
    ),
  }),
  normalizeSection: (section, index) => ({
    ...section,
    blockKey: DESTINATION_SECTION_ORDER[index] ?? section.blockKey,
  }),
  normalizeArticle: (article, sourceContext) =>
    normalizeDestinationArticle(article as DestinationArticle, sourceContext),
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
          : {
              heading: DESTINATION_BLOCK_LABELS[blockKey],
              content: PLACEHOLDER_NOTE.repeat(2),
              blockKey,
            },
      ),
    }),
};

/** Bai CMS khuyenmai (km-*) — 1 content, prompt khac theo site x postType (resolve o prompt-builder). */
const cmsProfile: ArticleTypeProfile = {
  outlineSchema: cmsOutlineSchema as z.ZodType<OutlineLike>,
  sectionSchema: contentSectionSchema,
  contentSchema: cmsArticleSchema as unknown as z.ZodType<AnyArticle>,
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
  contentSchema: articleCamNangSchema as unknown as z.ZodType<AnyArticle>,
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

export function getArticleTypeProfile(
  articleType: ArticleType,
): ArticleTypeProfile {
  // Moi articleType km-<postType> dung chung cmsProfile (output schema giong nhau);
  // khac biet nam o PROMPT (site x postType) resolve trong prompt-builder.
  if (articleType.startsWith("km-")) return cmsProfile;
  const profile = PROFILES[articleType];
  if (!profile)
    throw new Error(`Khong co profile cho articleType "${articleType}"`);
  return profile;
}

/** Type guard cho UI/gates: bai nay co phai bai diem den khong. */
export function isDestinationArticle(
  articleType: ArticleType,
  article: AnyArticle,
): article is DestinationArticle {
  return articleType === "guide-diem-den" && "quickFacts" in article;
}
