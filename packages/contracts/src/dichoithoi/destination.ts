import { z } from "zod/v4";
import { affiliateLinkItemSchema } from "./affiliate";

/**
 * Contracts cho khu Dichoithoi (M4) — mirror diem den + sync.
 * Schema DB dich (SQL Server) xem docs/dichoithoi/dichoithoi-database-redesign.md;
 * mirror Postgres phan chieu metadata de UI list/filter + auto-link.
 */

/** Cap trong cay du lich: tinh -> cum/quan the -> diem (redesign §3.1) */
export const destinationKindSchema = z.enum(["province", "cluster", "poi"]);
export type DestinationKind = z.infer<typeof destinationKindSchema>;

/** Trang thai noi dung cua 1 diem den trong AI tool (UI cot quan trong nhat — spec §7.2) */
export const destinationContentStateSchema = z.enum([
  "chua-co-bai", // chua co noi dung
  "bai-tay", // co noi dung viet tay (ContentSource=0), chua qua AI tool
  "dang-soan", // co content job dang chay/cho duyet (chua Approved)
  "da-duyet", // job da Approved tren zinoflow, cho publish (van chi o Postgres)
  "da-publish", // bai AI da publish (ContentSource=1)
]);
export type DestinationContentState = z.infer<typeof destinationContentStateSchema>;

/**
 * Tinh trang diem den ben production (SQL Server), suy tu siteId + Status:
 * - not-live: chua ton tai ben SQL Server (siteId = null)
 * - online: Status=1 (hien tren web) · hidden: Status=2 (co URL nhung an) · draft: Status=0
 */
export const destinationProductionStateSchema = z.enum(["online", "hidden", "draft", "not-live"]);
export type DestinationProductionState = z.infer<typeof destinationProductionStateSchema>;

/** Co canh bao tu job dong bo mirror (spec §12.1) */
export const destinationSyncFlagSchema = z.enum(["edited-outside", "conflict", "orphan"]);
export type DestinationSyncFlag = z.infer<typeof destinationSyncFlagSchema>;

/**
 * Do uu tien noi dung, DOC LAP voi `kind` (content-seo-ux-plan §10.6.1, Phase 25).
 * Chi co y nghia voi kind IN (province, cluster) — gan tay boi admin (curated).
 * flagship = node duoc dau tu noi dung day du (8 khoi); standard = node con lai.
 */
export const destinationContentTierSchema = z.enum(["flagship", "standard"]);
export type DestinationContentTier = z.infer<typeof destinationContentTierSchema>;

/**
 * Gia ve CO DINH CHINH THUC theo doi tuong (nguoi lon/tre em/...), do chinh
 * diem den quy dinh — nhap tay HOAN TOAN, AI khong duoc tu sinh/doan so nay
 * (content-seo-ux-plan §5.5a). Khac han gia tung nha cung cap trong ticketLinks[].
 */
export const priceBreakdownItemSchema = z.object({
  audience: z.string().min(1).max(64),
  price: z.number().nonnegative(),
  note: z.string().max(200).nullable(),
});
export type PriceBreakdownItem = z.infer<typeof priceBreakdownItemSchema>;

/**
 * Luu y thuc te gop 1 khoi (bai do xe, nha ve sinh, phu hop tre em/nguoi gia,
 * quy dinh tai cho, an toan) — content-seo-ux-plan §5.7. AI chi goi y draft,
 * BAT BUOC nguoi dung duyet/sua truoc khi luu (anh huong an toan thuc te).
 */
export const practicalNoteItemSchema = z.object({
  icon: z.string().max(8).nullable(),
  label: z.string().min(1).max(80),
  note: z.string().min(1).max(300),
});
export type PracticalNoteItem = z.infer<typeof practicalNoteItemSchema>;

/**
 * 1 mục trong 1 ngày lịch trình (vd "Sáng — Hồ Xuân Hương") — nhóm B, form
 * theo ngày (Phase 28.0, content-seo-ux-plan §10.6.2 khối 3). `poiSlug` tuỳ
 * chọn để link nội bộ tới đúng điểm tham quan con.
 */
export const itineraryItemSchema = z.object({
  period: z.string().min(1).max(20),
  poiSlug: z.string().max(64).nullable(),
  note: z.string().min(1).max(300),
});
export type ItineraryItem = z.infer<typeof itineraryItemSchema>;

export const itineraryDaySchema = z.object({
  dayLabel: z.string().min(1).max(20),
  items: z.array(itineraryItemSchema).min(1).max(6),
});
export type ItineraryDay = z.infer<typeof itineraryDaySchema>;

/** 1 mẫu lịch trình (vd "2N1D") — chỉ có ý nghĩa với kind IN (province, cluster) */
export const itineraryPlanSchema = z.object({
  label: z.string().min(1).max(20),
  days: z.array(itineraryDaySchema).min(1).max(5),
});
export type ItineraryPlan = z.infer<typeof itineraryPlanSchema>;

/** Link Google Maps/TripAdvisor... nhập tay, website render rel="nofollow" */
export const externalReviewUrlItemSchema = z.object({
  label: z.string().min(1).max(64),
  url: z.url().max(1024),
});
export type ExternalReviewUrlItem = z.infer<typeof externalReviewUrlItemSchema>;

/** 1 dong mirror diem den (Postgres) tra ve cho UI */
export const destinationMirrorSchema = z.object({
  /** Id int ben SQL Server (null khi diem tao moi trong AI tool, chua publish lan nao) */
  siteId: z.number().int().nullable(),
  slug: z.string().min(1).max(64),
  kind: destinationKindSchema,
  parentSlug: z.string().nullable(),
  provinceCode: z.string().nullable(),
  provinceName: z.string().nullable(),
  name: z.string().min(1).max(128),
  shortDescription: z.string().nullable(),
  thumbnail: z.string().nullable(),
  /** Full URL anh thumb (base + thumbnail) de UI hien truc tiep — null khi chua co */
  imageUrl: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  addressNew: z.string().nullable(),
  addressOld: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactWebsite: z.string().nullable(),
  /** Nhieu link mua ve (Klook, TripVision...) — thay BookingUrl 1 link cu (redesign §4.2/§4.3) */
  ticketLinks: z.array(affiliateLinkItemSchema),
  /** Gia ve theo doi tuong, nhap tay hoan toan (content-seo-ux-plan §5.5a) */
  priceBreakdown: z.array(priceBreakdownItemSchema),
  /** Luu y thuc te — AI goi y, nguoi dung duyet (content-seo-ux-plan §5.7) */
  practicalNotes: z.array(practicalNoteItemSchema),
  /** Lich trinh goi y (2N1D/3N2D...) — nhap tay hoan toan, chi Flagship (Phase 28.0) */
  itinerary: z.array(itineraryPlanSchema),
  /** Danh gia bien tap — text ngan, AI goi y + nguoi dung duyet (Phase 28.0) */
  editorialReview: z.string().nullable(),
  /** Link Google Maps/TripAdvisor... nhap tay (Phase 28.0) */
  externalReviewUrls: z.array(externalReviewUrlItemSchema),
  hotelGroupId: z.string().nullable(),
  isFeatured: z.boolean(),
  /** Chi y nghia voi kind IN (province, cluster) — null = chua gan (mac dinh nhu Standard) */
  contentTier: destinationContentTierSchema.nullable(),
  /** 0 draft, 1 published, 2 hidden — theo cot Status SQL Server */
  siteStatus: z.number().int().min(0).max(2).nullable(),
  contentState: destinationContentStateSchema,
  /** Tinh trang ben production (suy tu siteId + siteStatus) — cot rieng tren UI */
  productionState: destinationProductionStateSchema,
  /** Job ai-content dang soan cho diem nay — UI link sang man review */
  activeContentJobId: z.string().nullable(),
  syncFlags: z.array(destinationSyncFlagSchema),
  siteUpdatedAt: z.string().nullable(),
  syncedAt: z.string().nullable(),
});
export type DestinationMirror = z.infer<typeof destinationMirrorSchema>;

/**
 * Ket qua upload anh dai dien qua FTP (giai doan 2 — spec §14.3).
 * paths = duong dan TUONG DOI (so voi DICHOITHOI_IMAGE_BASE_URL) cua 3 co WebP;
 * thumbnail = path duoc ghi vao cot Thumbnail (dung co thumb cho card danh sach).
 */
export const uploadDestinationImageResponseSchema = z.object({
  slug: z.string(),
  thumbnail: z.string(),
  paths: z.object({
    hero: z.string(),
    medium: z.string(),
    thumb: z.string(),
  }),
});
export type UploadDestinationImageResponse = z.infer<typeof uploadDestinationImageResponseSchema>;

/**
 * Migrate anh layout CU ({slug}.webp + thumbnail/{slug}.webp) sang solution moi
 * ({slug}/{slug}-hero|medium|thumb.webp — giu slug trong ten file cho SEO anh)
 * — tai full cu ve, tao 3 co WebP, FTP len, dien cot Thumbnail. KHONG xoa anh cu
 * (website con fallback path cu).
 */
export const migrateDestinationImagesRequestSchema = z.object({
  /** true = chi quet + liet ke diem se migrate, khong tai/ghi gi */
  dryRun: z.boolean(),
  /** So diem migrate moi lan bam (chay lai nhieu lan cho het — idempotent) */
  limit: z.number().int().min(1).max(100).default(20),
});
export type MigrateDestinationImagesRequest = z.infer<
  typeof migrateDestinationImagesRequestSchema
>;

export const migrateDestinationImagesReportSchema = z.object({
  dryRun: z.boolean(),
  /** Tong so diem trong mirror */
  scanned: z.number().int(),
  /** Da o dinh dang moi ({slug}/{slug}-thumb.webp) — bo qua */
  alreadyNew: z.number().int(),
  /** Tong so diem CAN migrate (truoc lan chay nay) */
  candidates: z.number().int(),
  /** Migrate thanh cong lan nay */
  migrated: z.array(z.string()),
  /** Khong tai duoc anh full cu (404/loi mang) — can xu ly tay */
  missingSource: z.array(z.string()),
  /** Loi xu ly/upload — xem message de sua */
  failed: z.array(z.object({ slug: z.string(), error: z.string() })),
  /** So diem con lai chua migrate sau lan chay nay */
  remaining: z.number().int(),
  durationMs: z.number(),
});
export type MigrateDestinationImagesReport = z.infer<
  typeof migrateDestinationImagesReportSchema
>;

/** Cot sort duoc tren man danh sach diem den */
export const destinationSortBySchema = z.enum(["name", "province", "kind", "contentState"]);
export type DestinationSortBy = z.infer<typeof destinationSortBySchema>;

/** Query list diem den */
export const listDestinationsQuerySchema = z.object({
  q: z.string().optional(),
  provinceCode: z.string().optional(),
  kind: destinationKindSchema.optional(),
  contentState: destinationContentStateSchema.optional(),
  production: destinationProductionStateSchema.optional(),
  sortBy: destinationSortBySchema.default("name"),
  sortDir: z.enum(["asc", "desc"]).default("asc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListDestinationsQuery = z.infer<typeof listDestinationsQuerySchema>;

export const listDestinationsResponseSchema = z.object({
  items: z.array(destinationMirrorSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type ListDestinationsResponse = z.infer<typeof listDestinationsResponseSchema>;

/** Ket qua job dong bo mirror (spec §12.1) */
export const syncDestinationsResultSchema = z.object({
  added: z.number().int(),
  updated: z.number().int(),
  unchanged: z.number().int(),
  editedOutside: z.array(z.string()),
  conflicts: z.array(z.string()),
  orphans: z.array(z.string()),
  durationMs: z.number().int(),
});
export type SyncDestinationsResult = z.infer<typeof syncDestinationsResultSchema>;

/** URL nguon tham khao theo truong (spec §3.6) — gia ve tu trang ve chinh thuc... */
export const referenceUrlSchema = z.object({
  /** Truong du lieu ma nguon nay tham khao cho (vd "Giá vé", "Giờ mở cửa") */
  label: z.string().min(1).max(100),
  url: z.url().max(500),
});
export type ReferenceUrl = z.infer<typeof referenceUrlSchema>;

/** Request tao content job cho 1 diem den (spec §5.1) */
export const createDestinationJobRequestSchema = z.object({
  /** create = diem chua co bai AI; update = viet lai dua tren content hien tai */
  mode: z.enum(["create", "update"]),
  /** Ghi chu/du lieu bo sung nguoi dung cung cap (gia ve, gio mo cua...) — tuy chon */
  userNotes: z.string().max(10_000).optional(),
  /** Nguon tham khao theo truong — fetch text dua vao ngu canh prompt (spec §3.6) */
  referenceUrls: z.array(referenceUrlSchema).max(5).optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type CreateDestinationJobRequest = z.infer<typeof createDestinationJobRequestSchema>;

/** Luu thong tin cung cap cho AI ma KHONG tao bai (nut "Luu thong tin") */
export const saveAiInputsRequestSchema = z.object({
  userNotes: z.string().max(10_000).nullable().optional(),
  referenceUrls: z.array(referenceUrlSchema).max(5).optional(),
});
export type SaveAiInputsRequest = z.infer<typeof saveAiInputsRequestSchema>;

export const createDestinationJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.string(),
});
export type CreateDestinationJobResponse = z.infer<typeof createDestinationJobResponseSchema>;

/** 1 link noi bo vua duoc chen vao bai (engine auto-link) */
export const addedLinkSchema = z.object({
  targetSlug: z.string(),
  targetName: z.string(),
});
export type AddedLink = z.infer<typeof addedLinkSchema>;

/** Ket qua publish 1 bai diem den xuong SQL Server (Phase C) */
export const publishDestinationResultSchema = z.object({
  slug: z.string(),
  jobId: z.string(),
  /** Link noi bo engine auto-link da chen vao than bai */
  addedLinks: z.array(addedLinkSchema),
  /** So diem den duoc tinh lai khoi lien quan (RelatedJson) sau publish */
  relatedRecomputed: z.number().int(),
  durationMs: z.number().int(),
});
export type PublishDestinationResult = z.infer<typeof publishDestinationResultSchema>;

/** Request re-link toan bo (spec §12.2) — dryRun = xem truoc, khong ghi */
export const relinkAllRequestSchema = z.object({
  dryRun: z.boolean().default(true),
});
export type RelinkAllRequest = z.infer<typeof relinkAllRequestSchema>;

export const relinkArticleChangeSchema = z.object({
  slug: z.string(),
  addedLinks: z.array(addedLinkSchema),
  /** Link da chuan hoa theo SlugRedirect: "cu -> moi" */
  normalizedLinks: z.array(z.string()),
});

/** Bao cao re-link toan bo (spec §12.2 buoc 6) */
export const relinkAllReportSchema = z.object({
  dryRun: z.boolean(),
  scanned: z.number().int(),
  changed: z.number().int(),
  linksAdded: z.number().int(),
  linksNormalized: z.number().int(),
  details: z.array(relinkArticleChangeSchema),
  durationMs: z.number().int(),
});
export type RelinkAllReport = z.infer<typeof relinkAllReportSchema>;

/** Bao cao recompute related toan bo (spec §12.3) */
export const recomputeRelatedReportSchema = z.object({
  scanned: z.number().int(),
  /** Chi dem bai co RelatedJson THAY DOI (so sanh truoc khi ghi — spec §12.3) */
  updated: z.number().int(),
  durationMs: z.number().int(),
});
export type RecomputeRelatedReport = z.infer<typeof recomputeRelatedReportSchema>;

/** 1 diem den lien quan toi diem dang xem (cho trang chi tiet §7.3 tab Quan he) */
export const relatedDestinationRefSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: destinationKindSchema,
  contentState: destinationContentStateSchema,
  /** Chi co voi nearby — khoang cach met */
  distanceMeters: z.number().int().nullable(),
});
export type RelatedDestinationRef = z.infer<typeof relatedDestinationRefSchema>;

/** Noi dung hien tai cua 1 diem den tren website (SQL Server) — cho trang detail */
export const destinationSiteContentSchema = z.object({
  /** HTML than bai dang hien thi tren web (bai AI da publish hoac bai viet tay) */
  contentHtml: z.string(),
  openingTime: z.string().nullable(),
  ticketPrice: z.string().nullable(),
  transport: z.string().nullable(),
  food: z.string().nullable(),
  hotel: z.string().nullable(),
  tip: z.string().nullable(),
});
export type DestinationSiteContent = z.infer<typeof destinationSiteContentSchema>;

/**
 * Chi tiet 1 diem den (spec §7.3) — mirror + quan he + URL anh + job dang chay.
 * Tat ca thong tin gom theo nhom de trang detail hien day du.
 */
export const destinationDetailSchema = destinationMirrorSchema.extend({
  /** Full URL anh (base + thumbnail) — null khi chua cau hinh base hoac chua co anh */
  imageUrl: z.string().nullable(),
  /** Trang thai job ai-content dang chay (neu co) — de hien link dung cho */
  activeJobStatus: z.string().nullable(),
  /** Noi dung hien tai tren web — null khi chua co bai hoac chua ket noi SQL Server */
  content: destinationSiteContentSchema.nullable(),
  /** Thong tin nguoi dung da luu cho AI (tu dien lai form viet bai) */
  aiNotes: z.string().nullable(),
  aiReferenceUrls: z.array(referenceUrlSchema),
  /** Cay: cha truc tiep + con truc tiep */
  parent: relatedDestinationRefSchema.nullable(),
  children: z.array(relatedDestinationRefSchema),
  /** Quan he (spec §7.3 tab 3) */
  nearby: z.array(relatedDestinationRefSchema),
  relatedCurated: z.array(relatedDestinationRefSchema),
  /** Cac bai NHAC toi diem nay (mentioned) — "duoc nhac trong bai nao" */
  mentionedBy: z.array(relatedDestinationRefSchema),
});
export type DestinationDetail = z.infer<typeof destinationDetailSchema>;

/**
 * Tao moi / sua metadata 1 diem den (spec §7.3 tab Thong tin).
 * Dung chung cho POST /destinations (tao) va PATCH /destinations/:slug (sua).
 * Khi tao: slug bat buoc, chua ton tai. Khi sua: slug lay tu URL, body bo qua slug.
 */
export const upsertDestinationRequestSchema = z.object({
  /** kebab-case, dung lam URL /diem-den/{slug} — chi dat khi tao moi */
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
  name: z.string().min(1).max(128),
  kind: destinationKindSchema,
  parentSlug: z.string().max(64).nullable().optional(),
  provinceCode: z.string().max(2).nullable().optional(),
  shortDescription: z.string().max(1000).nullable().optional(),
  thumbnail: z.string().max(256).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  addressNew: z.string().max(256).nullable().optional(),
  addressOld: z.string().max(256).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  contactWebsite: z.string().max(256).nullable().optional(),
  hotelGroupId: z.string().max(50).nullable().optional(),
  isFeatured: z.boolean().optional(),
  contentTier: destinationContentTierSchema.nullable().optional(),
});
export type UpsertDestinationRequest = z.infer<typeof upsertDestinationRequestSchema>;

/**
 * Doi slug 1 diem den DA TON TAI (Phase 24 chieu ghi) — thao tac rieng, KHONG
 * gop vao upsertDestinationRequestSchema vi can canh bao rieng + cascade
 * (con chau, hotel/tour map, SlugRedirect...). slug cu lay tu URL.
 */
export const renameDestinationSlugRequestSchema = z.object({
  newSlug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
});
export type RenameDestinationSlugRequest = z.infer<typeof renameDestinationSlugRequestSchema>;

export const renameDestinationSlugResponseSchema = z.object({
  oldSlug: z.string(),
  newSlug: z.string(),
});
export type RenameDestinationSlugResponse = z.infer<typeof renameDestinationSlugResponseSchema>;

/**
 * 1 dong import hang loat — giong upsert nhung slug TUY CHON (thieu thi server
 * tu sinh tu ten) + kem thong tin cho AI (ghi chu + URL nguon).
 */
export const destinationImportRowSchema = z.object({
  slug: z
    .string()
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang")
    .optional(),
  name: z.string().min(1).max(128),
  kind: destinationKindSchema.default("poi"),
  parentSlug: z.string().max(64).nullable().optional(),
  provinceCode: z.string().max(2).nullable().optional(),
  shortDescription: z.string().max(1000).nullable().optional(),
  thumbnail: z.string().max(256).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  addressNew: z.string().max(256).nullable().optional(),
  addressOld: z.string().max(256).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  contactWebsite: z.string().max(256).nullable().optional(),
  hotelGroupId: z.string().max(50).nullable().optional(),
  isFeatured: z.boolean().optional(),
  contentTier: destinationContentTierSchema.nullable().optional(),
  aiNotes: z.string().max(10_000).nullable().optional(),
  referenceUrls: z.array(referenceUrlSchema).max(5).optional(),
});
export type DestinationImportRow = z.infer<typeof destinationImportRowSchema>;

export const importDestinationsRequestSchema = z.object({
  items: z.array(destinationImportRowSchema).min(1).max(1000),
});
export type ImportDestinationsRequest = z.infer<typeof importDestinationsRequestSchema>;

// fetchSheetRequestSchema/FetchSheetResponse -> dung chung, xem ./sheet-import.ts

export const importDestinationsResultSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  errors: z.array(z.object({ row: z.number().int(), slug: z.string(), message: z.string() })),
});
export type ImportDestinationsResult = z.infer<typeof importDestinationsResultSchema>;

/** AI goi y metadata "mem" cho 1 diem den (spec §3.5: KHONG dung lat/lng/dia chi) */
export const suggestDestinationMetaRequestSchema = z.object({
  name: z.string().min(1).max(128),
  /** Ten tinh (neu da chon) — giup AI goi y dung vung mien */
  provinceName: z.string().max(128).nullable().optional(),
  aiProvider: z.string().optional(),
  aiModel: z.string().optional(),
});
export type SuggestDestinationMetaRequest = z.infer<typeof suggestDestinationMetaRequestSchema>;

export const destinationMetaSuggestionSchema = z.object({
  /** Mo ta ngan 1-2 cau (tieng Viet co dau) */
  shortDescription: z.string().min(1).max(1000),
  /** Goi y cap: tinh / cum / diem */
  suggestedKind: destinationKindSchema,
  /** Tu khoa tim kiem, cach nhau dau phay */
  searchKeyword: z.string().max(250),
});
export type DestinationMetaSuggestion = z.infer<typeof destinationMetaSuggestionSchema>;

/** Cap nhat duong dan thumbnail cho 1 diem den (spec §14.3 — MVP) */
export const updateThumbnailRequestSchema = z.object({
  /** Duong dan TUONG DOI (vd "nui-ham-rong-sapa.webp" | "diem-den/{slug}/{slug}-thumb.webp") */
  thumbnail: z.string().max(256).nullable(),
});
export type UpdateThumbnailRequest = z.infer<typeof updateThumbnailRequestSchema>;

/**
 * Cap nhat danh sach link mua ve cho 1 diem den (affiliate-link-conversion-spec §5).
 * Nguoi dung chi nhap provider/label/sourceUrl — affiliateUrl/linkStatus server
 * tu tinh qua AffiliateLinkResolver luc luu (khong nhan tu client).
 */
export const updateTicketLinksRequestSchema = z.object({
  ticketLinks: z
    .array(
      z.object({
        provider: z.string().min(1).max(64),
        label: z.string().max(128).nullable().optional(),
        sourceUrl: z.url().max(1024),
        /** Gia tham khao rieng nha cung cap nay — tuy chon (content-seo-ux-plan §5.5b) */
        price: z.number().nonnegative().nullable().optional(),
      }),
    )
    .max(10),
});
export type UpdateTicketLinksRequest = z.infer<typeof updateTicketLinksRequestSchema>;

/** Cap nhat gia ve theo doi tuong — nhap tay hoan toan (content-seo-ux-plan §5.5a) */
export const updatePriceBreakdownRequestSchema = z.object({
  priceBreakdown: z.array(priceBreakdownItemSchema).max(10),
});
export type UpdatePriceBreakdownRequest = z.infer<typeof updatePriceBreakdownRequestSchema>;

/** Cap nhat khoi luu y thuc te — sau khi nguoi dung duyet/sua ban AI goi y (content-seo-ux-plan §5.7) */
export const updatePracticalNotesRequestSchema = z.object({
  practicalNotes: z.array(practicalNoteItemSchema).max(10),
});
export type UpdatePracticalNotesRequest = z.infer<typeof updatePracticalNotesRequestSchema>;

/** Ket qua goi y luu y thuc te (chua luu) — nguoi dung xem/sua/xoa truoc khi luu that */
export const suggestPracticalNotesResponseSchema = z.object({
  suggestions: z.array(practicalNoteItemSchema),
});
export type SuggestPracticalNotesResponse = z.infer<typeof suggestPracticalNotesResponseSchema>;

/** Cap nhat lich trinh goi y — nhap tay hoan toan (Phase 28.0) */
export const updateItineraryRequestSchema = z.object({
  itinerary: z.array(itineraryPlanSchema).max(4),
});
export type UpdateItineraryRequest = z.infer<typeof updateItineraryRequestSchema>;

/** Cap nhat danh gia bien tap — sau khi nguoi dung duyet/sua ban AI goi y (Phase 28.0) */
export const updateEditorialReviewRequestSchema = z.object({
  editorialReview: z.string().max(500).nullable(),
});
export type UpdateEditorialReviewRequest = z.infer<typeof updateEditorialReviewRequestSchema>;

/** Ket qua AI goi y danh gia bien tap (chua luu) */
export const suggestEditorialReviewResponseSchema = z.object({
  suggestion: z.string(),
});
export type SuggestEditorialReviewResponse = z.infer<typeof suggestEditorialReviewResponseSchema>;

/** Cap nhat link Google Maps/TripAdvisor... nhap tay (Phase 28.0) */
export const updateExternalReviewUrlsRequestSchema = z.object({
  externalReviewUrls: z.array(externalReviewUrlItemSchema).max(5),
});
export type UpdateExternalReviewUrlsRequest = z.infer<typeof updateExternalReviewUrlsRequestSchema>;

/** Kiem tra anh ton tai tren hosting (HEAD request — spec §14.3) */
export const checkImageRequestSchema = z.object({
  path: z.string().min(1).max(256),
});
export type CheckImageRequest = z.infer<typeof checkImageRequestSchema>;

export const checkImageResponseSchema = z.object({
  /** Full URL da ghep tu base + path */
  url: z.string(),
  exists: z.boolean(),
  /** HTTP status tu HEAD (0 neu loi mang/timeout) */
  status: z.number().int(),
});
export type CheckImageResponse = z.infer<typeof checkImageResponseSchema>;

/** Tach lat/lng tu link Google Maps dan vao (spec destination-spec §2.1.1) */
export const parseMapsLinkRequestSchema = z.object({
  url: z.string().min(1).max(2048),
});
export type ParseMapsLinkRequest = z.infer<typeof parseMapsLinkRequestSchema>;

export const parseMapsLinkResponseSchema = z.object({
  /** null khi khong parse duoc (link sai dinh dang/khong phai Google Maps) */
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});
export type ParseMapsLinkResponse = z.infer<typeof parseMapsLinkResponseSchema>;

/** Taxonomy cho form/filter */
export const destinationTaxonomySchema = z.object({
  provinces: z.array(
    z.object({ provinceCode: z.string(), name: z.string(), shortName: z.string() }),
  ),
  // id: SQL Server driver co the tra ve dang chuoi ("64") — coerce de khong vo taxonomy
  types: z.array(z.object({ id: z.coerce.number().int(), slug: z.string(), name: z.string() })),
});
export type DestinationTaxonomy = z.infer<typeof destinationTaxonomySchema>;

/**
 * Noi dung mo ta rieng cho trang danh muc /loai, /loai/{group}, /loai/{group}/{type},
 * /tinh/{slug} (Phase 18.2, content-seo-ux-plan §10.3) — tranh thin content, KHONG
 * phai taxonomy form/filter (khac destinationTaxonomySchema o tren).
 */
export const taxonomyContentGroupSchema = z.object({
  id: z.coerce.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});
export type TaxonomyContentGroup = z.infer<typeof taxonomyContentGroupSchema>;

export const taxonomyContentTypeSchema = z.object({
  id: z.coerce.number().int(),
  groupId: z.coerce.number().int(),
  slug: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});
export type TaxonomyContentType = z.infer<typeof taxonomyContentTypeSchema>;

export const taxonomyContentProvinceSchema = z.object({
  id: z.coerce.number().int(),
  slug: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
});
export type TaxonomyContentProvince = z.infer<typeof taxonomyContentProvinceSchema>;

export const taxonomyContentSchema = z.object({
  groups: z.array(taxonomyContentGroupSchema),
  types: z.array(taxonomyContentTypeSchema),
  provinces: z.array(taxonomyContentProvinceSchema),
});
export type TaxonomyContent = z.infer<typeof taxonomyContentSchema>;

export const updateTaxonomyDescriptionRequestSchema = z.object({
  target: z.enum(["group", "type", "province"]),
  id: z.number().int(),
  description: z.string().max(2000).nullable(),
});
export type UpdateTaxonomyDescriptionRequest = z.infer<typeof updateTaxonomyDescriptionRequestSchema>;

/**
 * Tra cuu dia chi cu -> moi (sau sap nhap don vi hanh chinh 2025).
 * Nguon: bang admin_ward_mappings (seed dvhcvn). Chi doc, phuc vu tra cuu.
 */
export const addressMappingsQuerySchema = z.object({
  /** Tim theo ten phuong/xa/quan cu hoac phuong/xa moi (go co dau) */
  q: z.string().optional(),
  /** Loc theo tinh/thanh CU (truoc sap nhap) */
  oldProvinceName: z.string().optional(),
  /** Loc theo tinh/thanh MOI (sau sap nhap) */
  newProvinceName: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AddressMappingsQuery = z.infer<typeof addressMappingsQuerySchema>;

export const addressMappingSchema = z.object({
  id: z.number().int(),
  oldWardCode: z.string().nullable(),
  oldWardName: z.string().nullable(),
  oldDistrictName: z.string().nullable(),
  oldProvinceName: z.string().nullable(),
  newWardCode: z.string().nullable(),
  newWardName: z.string().nullable(),
  newProvinceName: z.string().nullable(),
});
export type AddressMapping = z.infer<typeof addressMappingSchema>;

export const addressMappingsResponseSchema = z.object({
  items: z.array(addressMappingSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type AddressMappingsResponse = z.infer<typeof addressMappingsResponseSchema>;

/** Danh sach tinh/thanh phuc vu bo loc tra cuu dia chi (cu va moi) */
export const addressMappingProvincesSchema = z.object({
  oldProvinces: z.array(z.string()),
  newProvinces: z.array(z.string()),
});
export type AddressMappingProvinces = z.infer<typeof addressMappingProvincesSchema>;
