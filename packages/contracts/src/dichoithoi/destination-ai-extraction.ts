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

/** 1 dong staging */
export const destinationAiExtractionSchema = z.object({
  destinationSlug: z.string().min(1).max(64),
  sourceUrls: z.array(z.string()),
  extractedAt: z.string(),
  fields: z.array(destinationAiExtractionFieldItemSchema),
});
export type DestinationAiExtraction = z.infer<typeof destinationAiExtractionSchema>;

/**
 * GET /destinations/:slug/ai-extraction — boc trong object (khong tra ve `null` o
 * top-level) vi NestJS/Express gui BODY RONG (khong phai literal "null") khi handler
 * tra ve null truc tiep, lam client .json() nem SyntaxError. extraction=null = chua
 * tung chay skill trich xuat cho diem nay.
 */
export const getDestinationAiExtractionResponseSchema = z.object({
  extraction: destinationAiExtractionSchema.nullable(),
});
export type GetDestinationAiExtractionResponse = z.infer<
  typeof getDestinationAiExtractionResponseSchema
>;

/**
 * Chap nhan cac truong da tick (§2.3) — chi index trong mang `fields` (vi
 * externalReviewUrl co the lap key nhieu lan, khong the khop theo key don thuan).
 */
export const acceptDestinationAiExtractionFieldsRequestSchema = z.object({
  acceptedIndexes: z.array(z.number().int().min(0)).min(1),
});
export type AcceptDestinationAiExtractionFieldsRequest = z.infer<
  typeof acceptDestinationAiExtractionFieldsRequestSchema
>;
