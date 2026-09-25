import { z } from "zod/v4";
import { destinationKindSchema } from "./destination";

/**
 * Contracts cho tinh nang tu dong tim googleMapsUrl + thong tin co ban —
 * dichoithoi-destination-geocode-audit-plan.md. Thuc thi qua Playwright
 * scrape Google Maps that (khong phai Places API, xem PlaywrightGoogleMapsProvider),
 * nen khong bi rang buoc dieu khoan cache cua Places API — luu day du du lieu
 * quet duoc trong bang staging, dung thang luc "Chap nhan" (xem
 * geocodeCandidateStagedItemSchema).
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
 * Giai doan 1a/1b — 1 dong staging/diem den. `placeId` la khoa on dinh de mo
 * lai dung ket qua (voi PlaywrightGoogleMapsProvider, day chinh la URL Google
 * Maps cua ket qua do — cung chinh la gia tri googleMapsUrlAtDiscovery).
 *
 * QUYET DINH 06/08/2026 (doi tu ban dau): luu DAY DU du lieu quet duoc luon
 * (lat/lng/URL/rating/web results...), KHONG con goi lai Google luc "Chap
 * nhan" nua — vi PlaywrightGoogleMapsProvider khong bi rang buoc dieu khoan
 * cache cua Google Places API (chi provider cu, da ngung dung, moi co rang
 * buoc do). Goi lai luc accept chi ton them 8-20s + tang rui ro bi chan ma
 * khong doi lay gi (dia diem tinh nhu chua/ao/ho hau nhu khong doi ten/dia
 * chi trong vai ngay cho duyet) — xem AcceptGeocodeCandidatesUseCase.
 */
export const geocodeCandidateStagedItemSchema = z.object({
  placeId: z.string(),
  displayNameAtDiscovery: z.string(),
  confidenceScore: z.number(),
  distanceToParentMetersAtDiscovery: z.number().nullable(),
  latAtDiscovery: z.number().nullable().optional(),
  lngAtDiscovery: z.number().nullable().optional(),
  /** URL Google Maps day du (khong bi cat ngan) — dung ghi thang vao googleMapsUrl cua destination */
  googleMapsUrlAtDiscovery: z.string().nullable().optional(),
  formattedAddressAtDiscovery: z.string().nullable().optional(),
  nationalPhoneNumberAtDiscovery: z.string().nullable().optional(),
  websiteUriAtDiscovery: z.string().nullable().optional(),
  businessStatusAtDiscovery: placeBusinessStatusSchema.nullable().optional(),
  ratingAtDiscovery: z.number().nullable().optional(),
  userRatingCountAtDiscovery: z.number().nullable().optional(),
  /** Link tu muc "Ket qua tren web" tren trang Google Maps cua dia diem — de ghi vao aiReferenceUrls luc Chap nhan */
  webResultUrlsAtDiscovery: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
});
export type GeocodeCandidateStagedItem = z.infer<typeof geocodeCandidateStagedItemSchema>;

/**
 * "not-found" = da quet nhung Google khong tra ket qua nao (khac "chua tung
 * quet" — khong co dong nao trong bang staging) — dung de: (1) bao nguoi
 * dung biet diem nay can tu tim tay, (2) loai khoi lan chay batch sau (xem
 * excludeAlreadyAttempted trong geocode-target-filter.ts), tranh quet lai vo
 * ich cai da biet truoc la khong ra ket qua.
 * "ambiguous" = che do quickOnly gap trang nhieu ket qua, CHU DONG bo qua
 * (khong ghe tung trang) de uu tien diem "vao la ra ngay" truoc (yeu cau
 * 07/08/2026). Phai GHI ro trang thai nay (khong de trong nhu chua-tung-
 * quet) — neu khong, moi lan batch chay lai (vd sau khi server restart) se
 * quet lai TU DAU danh sach, ghe lai dung nhung diem mo ho da biet roi, ton
 * thoi gian truoc khi toi duoc diem moi (bug thuc te nguoi dung phat hien
 * 07/08/2026: "sao cai de sau cu chay di chay lai"). Nguoi dung tu chon quet
 * ky lai (quickOnly=false, truyen slugs cu the) khi muon xu ly not.
 */
export const destinationGeocodeCandidateStatusSchema = z.enum([
  "pending",
  "ambiguous",
  "not-found",
  "accepted",
  "rejected",
]);
export type DestinationGeocodeCandidateStatus = z.infer<typeof destinationGeocodeCandidateStatusSchema>;

export const destinationGeocodeCandidateRecordSchema = z.object({
  destinationSlug: z.string(),
  /** Ten/cum cha/tinh cua CHINH diem den (khong phai ung vien Google) — join tu destination mirror de hien bang duyet de doc hon slug */
  destinationName: z.string().nullable(),
  parentName: z.string().nullable(),
  provinceName: z.string().nullable(),
  foundAt: z.string(),
  candidates: z.array(geocodeCandidateStagedItemSchema),
  status: destinationGeocodeCandidateStatusSchema,
});
export type DestinationGeocodeCandidateRecord = z.infer<typeof destinationGeocodeCandidateRecordSchema>;

/**
 * POST /destinations/geocode-batch — 2 cach chon pham vi: `slugs` (danh sach
 * tick tay tu checkbox trang danh sach — khi co, CHI dung slugs nay, bo qua
 * cac filter khac) HOAC filter (parentSlug/kind/provinceCode/missingCoords —
 * dung khi khong truyen slugs, vd nut "Tim toa do cho diem con cum nay").
 * Fire-and-forget qua pg-boss, KHONG phai batch AI (khong goi LLM — day la
 * vong lap scrape Google Maps thuong, xem RunGeocodeBatchUseCase).
 */
export const runGeocodeBatchRequestSchema = z.object({
  slugs: z.array(z.string()).min(1).optional(),
  parentSlug: z.string().nullable().optional(),
  kind: destinationKindSchema.optional(),
  provinceCode: z.string().optional(),
  missingCoords: z.boolean().optional(),
  /** Bo qua ngay cac diem ra nhieu ket qua (mo ho) — mac dinh: bat khi dung filter, tat khi truyen slugs cu the (xem ProcessGeocodeBatchUseCase) */
  quickOnly: z.boolean().optional(),
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

/**
 * POST /destinations/geocode-candidates/resolve-ambiguous — dung khi dong dang
 * "ambiguous" chi co ten (chua co toa do, xem ProcessGeocodeBatchUseCase) da
 * duoc nguoi dung/Claude xem qua VA XAC DINH dung 1 candidate trong so cac ten
 * da luu (yeu cau 10/08/2026: "bạn quản lý, tìm, phân tích... do bạn quyết
 * định hết"). `placeId` la href da luu san trong candidates cua dong do — mo
 * lai CHINH trang do de lay toa do/dia chi that, chuyen dong ve status
 * "pending" (CHUA ghi vao destination, van phai qua "Chấp nhận" nhu thuong —
 * khac accept, cai nay chi lam giau du lieu, khong ghi destination).
 */
export const resolveAmbiguousCandidateRequestSchema = z.object({
  selections: z
    .array(z.object({ destinationSlug: z.string(), placeId: z.string() }))
    .min(1),
});
export type ResolveAmbiguousCandidateRequest = z.infer<typeof resolveAmbiguousCandidateRequestSchema>;

export const resolveAmbiguousCandidateResponseSchema = z.object({
  resolved: z.number(),
  errors: z.array(z.object({ destinationSlug: z.string(), message: z.string() })),
});
export type ResolveAmbiguousCandidateResponse = z.infer<typeof resolveAmbiguousCandidateResponseSchema>;

/**
 * POST /destinations/geocode-candidates/skip — danh dau "rejected" (yeu cau
 * 08/08/2026: nut "Bo qua" trong bang duyet — nguoi dung tu kiem tra tay
 * sau, KHONG can Duyet nua). Khac "ambiguous" (batch tu dong bo qua tam,
 * VAN se quet lai sau) — "rejected" bi excludeAlreadyAttempted() loai VINH
 * VIEN khoi cac lan chay batch sau (theo filter), xem geocode-target-filter.ts.
 */
export const skipGeocodeCandidatesRequestSchema = z.object({
  slugs: z.array(z.string()).min(1),
});
export type SkipGeocodeCandidatesRequest = z.infer<typeof skipGeocodeCandidatesRequestSchema>;

export const skipGeocodeCandidatesResponseSchema = z.object({
  updated: z.number(),
});
export type SkipGeocodeCandidatesResponse = z.infer<typeof skipGeocodeCandidatesResponseSchema>;
