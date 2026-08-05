import { z } from "zod/v4";
import { destinationKindSchema } from "./destination";

/**
 * Contracts cho tinh nang tu dong tim googleMapsUrl + thong tin co ban qua
 * Google Places API (New) — dichoithoi-destination-geocode-audit-plan.md.
 * Chinh sach luu tru (da chot 05/08/2026): CHI placeId duoc luu vinh vien,
 * moi field khac (dia chi/SDT/gio mo cua/rating/anh) la snapshot tam thoi,
 * KHONG duoc luu tru lau dai theo dieu khoan Google — client luon phai xin
 * ban tuoi qua endpoint suggest, khong tu cache lau o phia FE.
 */

export const placeBusinessStatusSchema = z.enum([
  "OPERATIONAL",
  "CLOSED_TEMPORARILY",
  "CLOSED_PERMANENTLY",
]);
export type PlaceBusinessStatus = z.infer<typeof placeBusinessStatusSchema>;

/** 1 ung vien tra ve tu Google Places Text Search, da tinh confidence so voi cum cha */
export const placeGeocodeCandidateSchema = z.object({
  placeId: z.string(),
  displayName: z.string(),
  formattedAddress: z.string().nullable(),
  lat: z.number(),
  lng: z.number(),
  googleMapsUri: z.string().nullable(),
  businessStatus: placeBusinessStatusSchema.nullable(),
  nationalPhoneNumber: z.string().nullable(),
  websiteUri: z.string().nullable(),
  rating: z.number().nullable(),
  userRatingCount: z.number().nullable(),
  /** Ten photo resource (Google cam cache lau — chi dung goi Photo Media API live de xem truoc) */
  photoNames: z.array(z.string()),
  /** met, null neu cum cha chua co toa do de so sanh */
  distanceToParentMeters: z.number().nullable(),
  /** 0-1 — ket hop do giong ten (so voi ten dang tim) va khoang cach toi cum cha */
  confidenceScore: z.number(),
});
export type PlaceGeocodeCandidate = z.infer<typeof placeGeocodeCandidateSchema>;

/**
 * GET /destinations/:slug/geocode-suggestions — luon goi live, khong cache.
 * LUU Y BILLING (phat hien luc code, khac gia dinh luc lap plan): field mask
 * gop CA Pro lan Enterprise trong 1 request bi Google tinh phi theo SKU
 * Enterprise (SKU = tier CAO NHAT trong field mask cua ca request, khong
 * cong don rieng Pro+Enterprise) — nen quota chi con 1 muc dung chung
 * (Enterprise: 1000 free/thang), KHONG con 5000 free cua rieng Pro nhu uoc
 * tinh ban dau trong plan doc.
 */
export const getGeocodeSuggestionsResponseSchema = z.object({
  candidates: z.array(placeGeocodeCandidateSchema),
  /** So call da dung trong thang lich hien tai (SKU Enterprise, vi field mask gop ca 2 tier) */
  usageThisMonth: z.number(),
});
export type GetGeocodeSuggestionsResponse = z.infer<typeof getGeocodeSuggestionsResponseSchema>;

/**
 * Giai doan 1b (che do hang loat) — 1 dong staging/diem den. CHI luu placeId +
 * confidenceScore vinh vien (dung theo dieu khoan Google); displayName/
 * distance chi la nhan tam thoi LUC TIM RA (khong dam bao con dung, dung de
 * luot nhanh danh sach) — bang duyet phai goi lai endpoint refresh de lay
 * snapshot tuoi truoc khi Chap nhan.
 */
export const geocodeCandidateStagedItemSchema = z.object({
  placeId: z.string(),
  displayNameAtDiscovery: z.string(),
  confidenceScore: z.number(),
  distanceToParentMetersAtDiscovery: z.number().nullable(),
});
export type GeocodeCandidateStagedItem = z.infer<typeof geocodeCandidateStagedItemSchema>;

export const destinationGeocodeCandidateStatusSchema = z.enum(["pending", "accepted", "rejected"]);
export type DestinationGeocodeCandidateStatus = z.infer<typeof destinationGeocodeCandidateStatusSchema>;

export const destinationGeocodeCandidateRecordSchema = z.object({
  destinationSlug: z.string(),
  foundAt: z.string(),
  candidates: z.array(geocodeCandidateStagedItemSchema),
  status: destinationGeocodeCandidateStatusSchema,
});
export type DestinationGeocodeCandidateRecord = z.infer<typeof destinationGeocodeCandidateRecordSchema>;

/**
 * POST /destinations/geocode-batch — pham vi tai dung filter cua danh sach
 * diem den (parentSlug = nut "Tim toa do cho diem con cum nay" tren trang
 * cum; missingCoords=true = nut o trang danh sach dang loc). Fire-and-forget
 * qua pg-boss, KHONG phai batch AI (khong goi LLM — day la vong lap goi REST
 * API thuong, xem RunGeocodeBatchUseCase).
 */
export const runGeocodeBatchRequestSchema = z.object({
  parentSlug: z.string().nullable().optional(),
  kind: destinationKindSchema.optional(),
  provinceCode: z.string().optional(),
  missingCoords: z.boolean().optional(),
  /** Bat khi da vuot free-tier va nguoi dung chu dong xac nhan chay tiep (phat sinh phi) */
  acceptCostBeyondFreeTier: z.boolean().default(false),
});
export type RunGeocodeBatchRequest = z.infer<typeof runGeocodeBatchRequestSchema>;

export const runGeocodeBatchResponseSchema = z.object({
  jobId: z.string().nullable(),
  /** So diem se duoc xu ly (uoc tinh truoc khi enqueue, de hien canh bao quota) */
  targetCount: z.number(),
  usageThisMonth: z.number(),
});
export type RunGeocodeBatchResponse = z.infer<typeof runGeocodeBatchResponseSchema>;

/** GET /destinations/geocode-candidates — danh sach dong staging con pending, dung cho bang duyet */
export const listGeocodeCandidatesResponseSchema = z.object({
  records: z.array(destinationGeocodeCandidateRecordSchema),
});
export type ListGeocodeCandidatesResponse = z.infer<typeof listGeocodeCandidatesResponseSchema>;

/**
 * POST /destinations/geocode-candidates/accept — moi item chon 1 placeId cu
 * the trong danh sach candidates cua dong do (goi lai Place Details live de
 * lay snapshot tuoi truoc khi ghi that vao destination).
 */
export const acceptGeocodeCandidatesRequestSchema = z.object({
  selections: z
    .array(z.object({ destinationSlug: z.string(), placeId: z.string() }))
    .min(1),
});
export type AcceptGeocodeCandidatesRequest = z.infer<typeof acceptGeocodeCandidatesRequestSchema>;

export const acceptGeocodeCandidatesResponseSchema = z.object({
  updated: z.number(),
  errors: z.array(z.object({ destinationSlug: z.string(), message: z.string() })),
});
export type AcceptGeocodeCandidatesResponse = z.infer<typeof acceptGeocodeCandidatesResponseSchema>;
