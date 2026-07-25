import { z } from "zod/v4";

/**
 * Contracts cho tinh nang Claude trich xuat thong tin diem den tu Google Maps + web
 * tham khao — skill ghi vao bang staging, CMS hien bang so sanh cu/moi cho nguoi dung
 * duyet (docs/dichoithoi/dichoithoi-destination-ai-extraction-plan.md §2).
 */

/** Cac truong co the trich xuat — khop dung ten cot that tren dichoithoi_destinations */
export const destinationAiExtractionFieldKeySchema = z.enum([
  "name",
  "addressNew",
  "contactPhone",
  "contactWebsite",
  "shortDescription",
  "metaTitle",
  "openingHours",
  "aiReferenceSummary",
  "externalReviewUrl",
  "priceBreakdown",
  "editorialReview",
]);
export type DestinationAiExtractionFieldKey = z.infer<
  typeof destinationAiExtractionFieldKeySchema
>;

export const destinationOpeningHoursSchema = z.object({
  note: z.string().min(1).max(300),
  periods: z.array(
    z.object({
      days: z.array(z.string().min(1).max(16)).min(1),
      opens: z.string().min(1).max(8),
      closes: z.string().min(1).max(8),
    }),
  ),
});
export type DestinationOpeningHours = z.infer<typeof destinationOpeningHoursSchema>;

/**
 * 1 truong Claude trich xuat duoc (hoac khong tim thay) — §2.1. newValue=null khi
 * found=false (khong bia du lieu cung ngoai nguon). externalReviewUrl co the xuat
 * hien NHIEU lan trong mang fields (moi candidate 1 phan tu rieng).
 */
export const destinationAiExtractionFieldItemSchema = z.object({
  key: destinationAiExtractionFieldKeySchema,
  newValue: z.unknown().nullable(),
  currentValue: z.unknown().nullable(),
  found: z.boolean(),
  note: z.string().nullable(),
  status: z.enum(["pending", "accepted", "rejected"]),
});
export type DestinationAiExtractionFieldItem = z.infer<
  typeof destinationAiExtractionFieldItemSchema
>;

/**
 * Nguon tao ra 1 dong trich xuat — "skill" (Claude doc thu cong qua VS Code)
 * hoac "gsg" (Gemini + Google Search Grounding, tu dong trong app). 2 nguon
 * ton tai SONG SONG cho cung 1 diem den, khong ghi de nhau (PK composite
 * destination_slug+source). dichoithoi-destination-ai-extraction-plan.md §6 A1.
 */
export const destinationAiExtractionSourceSchema = z.enum(["skill", "gsg"]);
export type DestinationAiExtractionSource = z.infer<typeof destinationAiExtractionSourceSchema>;

/** 1 dong staging */
export const destinationAiExtractionSchema = z.object({
  destinationSlug: z.string().min(1).max(64),
  source: destinationAiExtractionSourceSchema,
  sourceUrls: z.array(z.string()),
  extractedAt: z.string(),
  fields: z.array(destinationAiExtractionFieldItemSchema),
});
export type DestinationAiExtraction = z.infer<typeof destinationAiExtractionSchema>;

/**
 * GET /destinations/:slug/ai-extraction — tra ve MANG 0-2 phan tu (toi da 1 dong
 * "skill" + 1 dong "gsg" cho cung diem den, §6 A3/C1). Rong = chua tung trich
 * xuat nguon nao. Boc trong object (khong tra mang tran o top-level) — quy uoc
 * chung cua API nay de FE luon parse duoc ket qua nhu nhau.
 */
export const getDestinationAiExtractionResponseSchema = z.object({
  extractions: z.array(destinationAiExtractionSchema),
});
export type GetDestinationAiExtractionResponse = z.infer<
  typeof getDestinationAiExtractionResponseSchema
>;

/**
 * Chap nhan cac truong da tick (§2.3) — chi index trong mang `fields` CUA DUNG 1
 * NGUON (`source`, vi externalReviewUrl co the lap key nhieu lan trong 1 nguon,
 * khong the khop theo key don thuan). §6 C2: bang so sanh 4 cot cho phep chon
 * nguon nao (skill/gsg) de ghi cho tung field — request phai noi ro dang chap
 * nhan tu nguon nao.
 */
export const acceptDestinationAiExtractionFieldsRequestSchema = z.object({
  source: destinationAiExtractionSourceSchema,
  acceptedIndexes: z.array(z.number().int().min(0)).min(1),
});
export type AcceptDestinationAiExtractionFieldsRequest = z.infer<
  typeof acceptDestinationAiExtractionFieldsRequestSchema
>;
