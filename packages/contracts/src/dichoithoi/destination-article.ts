import { z } from "zod/v4";
import { contentSectionSchema, faqItemSchema } from "../ai-content/article";

/**
 * Bai viet DIEM DEN du lich (articleType "guide-diem-den") —
 * spec docs/dichoithoi/dichoithoi-destination-spec.md §4.
 * Output AI map THANG sang cot v2.DestinationContent (redesign doc §4.3):
 * quickFacts -> cot rieng, intro + sections + faq -> ContentHtml,
 * metadata -> MetaTitle/MetaDescription + Destination.ShortDescription/SearchKeyword.
 */

/** Gioi han do dai theo cot SQL Server (chua le an toan duoi limit cot). */
export const DESTINATION_FIELD_LIMITS = {
  quickFactShort: 500, // OpeningTime/TicketPrice: nvarchar(512)
  description: 950, // ShortDescription: nvarchar(1000)
  searchKeyword: 250, // SearchKeyword: nvarchar(256)
  metaTitle: 145, // MetaTitle: nvarchar(150)
  metaDescription: 295, // MetaDescription: nvarchar(300)
} as const;

/**
 * Quick facts — du lieu co cau truc hien thi dang card tren web.
 * Muc nao khong ap dung (vd diem mien phi) AI phai ghi ro "Miễn phí" /
 * "Không áp dụng" thay vi bo trong — structure gate kiem tra.
 */
export const destinationQuickFactsSchema = z.object({
  openingTime: z.string().min(1).max(DESTINATION_FIELD_LIMITS.quickFactShort),
  ticketPrice: z.string().min(1).max(DESTINATION_FIELD_LIMITS.quickFactShort),
  transport: z.string().min(1),
  food: z.string().min(1),
  hotel: z.string().min(1),
  tip: z.string().min(1),
});
export type DestinationQuickFacts = z.infer<typeof destinationQuickFactsSchema>;

export const destinationArticleMetadataSchema = z.object({
  /** Ten chuan hoa co dau cua diem den */
  name: z.string().min(2).max(128),
  /** Goi y slug — nguoi dung xac nhan (mode create), bo qua khi update */
  slugSuggestion: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  metaTitle: z.string().min(10).max(DESTINATION_FIELD_LIMITS.metaTitle),
  metaDescription: z.string().min(50).max(DESTINATION_FIELD_LIMITS.metaDescription),
  /** Mo ta ngan — do vao Destination.ShortDescription */
  description: z.string().min(50).max(DESTINATION_FIELD_LIMITS.description),
  searchKeyword: z.string().min(2).max(DESTINATION_FIELD_LIMITS.searchKeyword),
});

/**
 * Frame bai diem den = toan bai TRU sections (buoc 3 cua pipeline 3 buoc).
 * updateNotice: dong "thong tin cap nhat thang X/nam" — policy gate travel bat buoc.
 */
export const destinationArticleFrameSchema = z.object({
  title: z.string().min(10).max(100),
  intro: z.string().min(80),
  quickFacts: destinationQuickFactsSchema,
  faq: z.array(faqItemSchema).min(3).max(6),
  updateNotice: z.string().min(10),
  metadata: destinationArticleMetadataSchema,
});
export type DestinationArticleFrame = z.infer<typeof destinationArticleFrameSchema>;

/** Bai diem den hoan chinh = frame + sections. */
export const destinationArticleSchema = destinationArticleFrameSchema.extend({
  sections: z.array(contentSectionSchema).min(3),
});
export type DestinationArticle = z.infer<typeof destinationArticleSchema>;

/** Outline buoc 1 — khong co plannedProducts (diem den khong co product). */
export const destinationOutlineSchema = z.object({
  title: z.string(),
  sectionHeadings: z.array(z.string()).min(3).max(8),
  plannedFaqQuestions: z.array(z.string()).min(3),
});
export type DestinationOutline = z.infer<typeof destinationOutlineSchema>;
