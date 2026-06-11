import { z } from "zod";

/**
 * Article 8-block framework — spec docs/specs/ai-content-technical-spec.md §17.
 * Day la schema bat buoc cho output AI (structured output) va cho render phia web.
 * Structure gate (§17.5) kiem tra du 8 block dua tren schema nay.
 */

/** Block 1 — Hero: H1 + subtitle + affiliate disclosure (bat buoc cho policy gate). */
export const heroBlockSchema = z.object({
  title: z.string().min(10),
  subtitle: z.string(),
  affiliateDisclosure: z.string().min(10),
});

/** Block 2 — Intent: bai viet danh cho ai, giai quyet van de gi. */
export const intentBlockSchema = z.object({
  forWho: z.string(),
  problem: z.string(),
});

/** Block 3 — Quick answer: tom tat ket luan nhanh 3-5 bullet. */
export const quickAnswerBlockSchema = z.object({
  bullets: z.array(z.string()).min(3).max(5),
});

/** Block 4 — Main content sections (H2/H3). */
export const contentSectionSchema = z.object({
  heading: z.string(),
  content: z.string().min(50),
});

/** Block 5 — Product recommendation item (uu/nhuoc diem, gia, doi tuong phu hop). */
export const productRecommendationSchema = z.object({
  name: z.string(),
  whyInList: z.string(),
  pros: z.array(z.string()).min(1),
  cons: z.array(z.string()).min(1),
  priceRange: z.string(),
  bestFor: z.string(),
  /** Data gate validate URL nay con hop le truoc khi cho approve. */
  productUrl: z.string().url(),
});

/** Block 6 — FAQ: 3-6 cau hoi theo search intent. */
export const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

/** Block 7 — Final CTA. */
export const finalCtaBlockSchema = z.object({
  text: z.string(),
  action: z.string(),
});

/** Block 8 — Metadata (khong hien thi trong noi dung chinh). */
export const articleMetadataSchema = z.object({
  metaTitle: z.string().max(70),
  metaDescription: z.string().max(170),
  slug: z.string(),
  internalLinkSuggestions: z.array(z.string()).min(2),
});

/**
 * Bai viet hoan chinh theo 8-block framework.
 * Day chinh la schema truyen cho AI structured output (zodOutputFormat).
 */
export const articleSchema = z.object({
  hero: heroBlockSchema,
  intent: intentBlockSchema,
  quickAnswer: quickAnswerBlockSchema,
  sections: z.array(contentSectionSchema).min(1),
  productRecommendations: z.array(productRecommendationSchema).min(1),
  faq: z.array(faqItemSchema).min(3).max(6),
  finalCta: finalCtaBlockSchema,
  metadata: articleMetadataSchema,
});
export type Article = z.infer<typeof articleSchema>;

/** Outline: buoc 1 cua generation — khung bai truoc khi expand tung section. */
export const articleOutlineSchema = z.object({
  title: z.string(),
  sectionHeadings: z.array(z.string()).min(1),
  plannedProducts: z.array(z.string()),
  plannedFaqQuestions: z.array(z.string()).min(3),
});
export type ArticleOutline = z.infer<typeof articleOutlineSchema>;
