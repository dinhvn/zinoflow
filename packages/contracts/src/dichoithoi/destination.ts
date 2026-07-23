import { z } from "zod/v4";
import { affiliateLinkItemSchema, affiliateLinkStatusSchema } from "./affiliate";
import { DESTINATION_FIELD_LIMITS } from "./destination-article";
import { destinationOpeningHoursSchema } from "./destination-ai-extraction";

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

/** Link Google Maps/TripAdvisor... nhập tay, website render rel="nofollow" */
export const externalReviewUrlItemSchema = z.object({
  label: z.string().min(1).max(64),
  url: z.url().max(1024),
});
export type ExternalReviewUrlItem = z.infer<typeof externalReviewUrlItemSchema>;

/**
 * 1 anh trong thu vien anh (khac thumbnail don) — website da doc san qua
 * `extras.Gallery` (DiChoiThoi.Web), field PascalCase khi ghi GalleryJson phai
 * khop dung model C# `GalleryItemModel` (Path/AltText/Caption/Credit).
 */
export const galleryItemSchema = z.object({
  path: z.string().min(1).max(512),
  altText: z.string().max(200).nullable(),
  caption: z.string().max(300).nullable(),
  credit: z.string().max(200).nullable(),
});
export type GalleryItem = z.infer<typeof galleryItemSchema>;

/** Ghi de nguyen mang thu vien anh — sua alt/caption/credit, doi thu tu, xoa anh */
export const updateDestinationGalleryRequestSchema = z.object({
  gallery: z.array(galleryItemSchema).max(30),
});
export type UpdateDestinationGalleryRequest = z.infer<typeof updateDestinationGalleryRequestSchema>;

/**
 * Mo ta rieng cho Anh dai dien (hero image, khac cau truc Thu vien anh —
 * khong co `path` vi da dung chung thumbnail) — cho phep hien alt/caption/
 * credit de tren anh hero to nhat trang chi tiet, giong Thu vien anh
 * (quyet dinh 07/2026, xem dichoithoi-backlog.md muc "SEO ảnh cho gallery hero").
 */
export const heroImageMetaSchema = z.object({
  altText: z.string().max(200).nullable(),
  caption: z.string().max(300).nullable(),
  credit: z.string().max(200).nullable(),
});
export type HeroImageMeta = z.infer<typeof heroImageMetaSchema>;

/** Ghi de mo ta Anh dai dien — null = xoa het (khong con alt/caption/credit rieng) */
export const updateHeroImageMetaRequestSchema = z.object({
  heroImageMeta: heroImageMetaSchema.nullable(),
});
export type UpdateHeroImageMetaRequest = z.infer<typeof updateHeroImageMetaRequestSchema>;

/**
 * 1 dong "vé tham quan" — bang rieng destination_tickets (thay ticketLinks[] nhung
 * trong Destination), quan ly giong Hotel/Tour (moi dong = 1 nguon ban ve, gan
 * DUNG 1 diem den — khac Hotel/Tour co the gan nhieu diem qua map table). Doc:
 * dichoithoi-ticket-analysis.md §11.5.
 */
export const destinationTicketSchema = z.object({
  id: z.string().uuid(),
  destinationSlug: z.string().min(1).max(64),
  label: z.string().max(128).nullable(),
  provider: z.string().min(1).max(64),
  sourceUrl: z.url().max(1024),
  affiliateUrl: z.string().max(1024),
  linkStatus: affiliateLinkStatusSchema,
  price: z.number().nonnegative().nullable(),
  /** Cung field Hotel/Tour da co — chi luu tru + nhap, hien thi tren web quyet dinh sau (tuy thiet ke) */
  thumbnailUrl: z.string().max(512).nullable(),
  order: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type DestinationTicket = z.infer<typeof destinationTicketSchema>;

/** 1 dong ve kem thong tin diem den — cho trang /dichoithoi/ve (danh sach toan bo) */
export const destinationTicketWithDestinationSchema = destinationTicketSchema.extend({
  destinationName: z.string(),
  provinceName: z.string().nullable(),
});
export type DestinationTicketWithDestination = z.infer<typeof destinationTicketWithDestinationSchema>;

/**
 * Tao/sua 1 dong ve — chi nhap provider/label/sourceUrl/price/thumbnailUrl,
 * affiliateUrl/linkStatus server tu tinh qua AffiliateLinkResolver luc luu
 * (giong ticketLinks cu). provider phai khop 1 affiliate_partners.code dang active.
 */
export const createDestinationTicketRequestSchema = z.object({
  provider: z.string().min(1).max(64),
  label: z.string().max(128).nullable().optional(),
  sourceUrl: z.url().max(1024),
  price: z.number().nonnegative().nullable().optional(),
  thumbnailUrl: z.string().max(512).nullable().optional(),
});
export type CreateDestinationTicketRequest = z.infer<typeof createDestinationTicketRequestSchema>;

/**
 * 1 dong nhap hang loat ve tu Google Sheet — khop theo destinationSlug + sourceUrl
 * (da co thi cap nhat, chua co thi tao moi). destinationSlug BAT BUOC khop dung
 * 1 diem den da co trong mirror — khong tu tao diem den moi tu import nay.
 */
export const destinationTicketImportRowSchema = z.object({
  destinationSlug: z.string().min(1).max(64),
  provider: z.string().min(1).max(64),
  label: z.string().max(128).nullable().optional(),
  sourceUrl: z.url().max(1024),
  price: z.number().nonnegative().nullable().optional(),
  thumbnailUrl: z.string().max(512).nullable().optional(),
});
export type DestinationTicketImportRow = z.infer<typeof destinationTicketImportRowSchema>;

export const importDestinationTicketsRequestSchema = z.object({
  items: z.array(destinationTicketImportRowSchema).min(1).max(1000),
});
export type ImportDestinationTicketsRequest = z.infer<typeof importDestinationTicketsRequestSchema>;

export const importDestinationTicketsResultSchema = z.object({
  created: z.number().int(),
  updated: z.number().int(),
  errors: z.array(z.object({ row: z.number().int(), destinationSlug: z.string(), message: z.string() })),
});
export type ImportDestinationTicketsResult = z.infer<typeof importDestinationTicketsResultSchema>;

export const updateDestinationTicketRequestSchema = createDestinationTicketRequestSchema.partial();
export type UpdateDestinationTicketRequest = z.infer<typeof updateDestinationTicketRequestSchema>;

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
  /** Toa do — CACHE tu tinh tu googleMapsUrl (khong con nhap tay), van dung that cho hotel auto-assign + related-builder */
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  /** Link Google Maps nhap tay 1 lan — nguon duy nhat cho lat/lng */
  googleMapsUrl: z.string().nullable(),
  addressNew: z.string().nullable(),
  addressOld: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactWebsite: z.string().nullable(),
  /**
   * Nhieu link mua ve (Klook, TripVision...) — CACHE tinh san tu bang
   * destination_tickets (§11.5), KHONG con sua truc tiep truong nay (sua qua
   * API /destinations/:slug/tickets). Giu de website doc TicketLinksJson nhanh,
   * khong join truc tiep luc render (redesign §4.2/§4.3).
   */
  ticketLinks: z.array(affiliateLinkItemSchema),
  /** Gia ve tai quay, van ban tu do — mirror 1 chieu tu SQL Server TicketPrice (Phase 4, sua tai CMS bai viet) */
  ticketPrice: z.string().nullable(),
  /** Gia ve theo doi tuong, nhap tay hoan toan (content-seo-ux-plan §5.5a) */
  priceBreakdown: z.array(priceBreakdownItemSchema),
  /** Luu y thuc te — AI goi y, nguoi dung duyet (content-seo-ux-plan §5.7) */
  practicalNotes: z.array(practicalNoteItemSchema),
  /** Danh gia bien tap — text ngan, AI goi y + nguoi dung duyet (Phase 28.0) */
  editorialReview: z.string().nullable(),
  /**
   * Meta title thu cong (sua qua bulk-edit CSV) — KHAC voi draftArticle.metadata.metaTitle
   * (AI soan, hien trong editor bai viet). Ghi thang len site, se bi ghi de neu publish lai bai.
   */
  metaTitle: z.string().nullable(),
  /** Link Google Maps/TripAdvisor... nhap tay (Phase 28.0) */
  externalReviewUrls: z.array(externalReviewUrlItemSchema),
  /** Thu vien anh (khac thumbnail don) — website render thanh dai cuon o hero + duoi hero */
  gallery: z.array(galleryItemSchema),
  /** Mo ta rieng cho Anh dai dien — de tren anh hero to nhat, giong Thu vien anh. null = chua nhap */
  heroImageMeta: heroImageMetaSchema.nullable(),
  hotelGroupId: z.string().nullable(),
  /** Do uu tien tay boi admin, 1-5 (1=cao nhat, mac dinh 3) — thay IsFeatured cu
   * (dichoithoi-destination-relations-plan.md §1.1, gop voi y tuong "do uu tien" moi). */
  priority: z.number().int().min(1).max(5),
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
  /** Loc theo cha truc tiep (slug cum/tinh) — vd xem het diem trong 1 cum */
  parentSlug: z.string().optional(),
  kind: destinationKindSchema.optional(),
  contentState: destinationContentStateSchema.optional(),
  production: destinationProductionStateSchema.optional(),
  /** true = chỉ điểm có giá vé thật (không "miễn phí") hoặc đã có link mua — trang /ve (doc §11.3) */
  hasTicketOpportunity: z.coerce.boolean().optional(),
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

/** Xem truoc prompt se gui AI cho 1 diem den (nut "Xem trước prompt" o tab AI ho tro) —
 * dung y het CreateDestinationJobRequest, KHONG tao job/khong goi AI. */
export const previewDestinationJobPromptRequestSchema = createDestinationJobRequestSchema;
export type PreviewDestinationJobPromptRequest = z.infer<
  typeof previewDestinationJobPromptRequestSchema
>;

/** Prompt buoc 1 (outline) se gui AI — dung nguyen system+prompt nhu luc job that chay.
 * Buoc 2 (content) dung sourceContext nay + outline AI tra ve o buoc 1 nen chua the
 * hien day du truoc (chua co outline) — chi ghi chu de nguoi dung biet. */
export const previewDestinationJobPromptResponseSchema = z.object({
  systemPrompt: z.string(),
  outlinePrompt: z.string(),
  sourceContext: z.string(),
});
export type PreviewDestinationJobPromptResponse = z.infer<
  typeof previewDestinationJobPromptResponseSchema
>;

/** 1 link noi bo vua duoc chen vao bai (engine auto-link) */
export const addedLinkSchema = z.object({
  targetSlug: z.string(),
  targetName: z.string(),
});
export type AddedLink = z.infer<typeof addedLinkSchema>;

/** Ket qua publish 1 bai diem den xuong SQL Server (Phase C) */
export const publishDestinationResultSchema = z.object({
  slug: z.string(),
  /** Job AI dang gan (neu con) — pivot gop editor: publish khong con bat buoc co job */
  jobId: z.string().nullable(),
  /** Link noi bo engine auto-link da chen vao than bai */
  addedLinks: z.array(addedLinkSchema),
  /** So diem den duoc tinh lai khoi lien quan (RelatedJson) sau publish */
  relatedRecomputed: z.number().int(),
  durationMs: z.number().int(),
});
export type PublishDestinationResult = z.infer<typeof publishDestinationResultSchema>;

/**
 * Xem truoc HTML se ghi vao v2.DestinationContent luc Publish (dry-run, khong ghi DB) —
 * chay dung renderDestinationBodyHtml + autoLinkContent nhung KHONG UPSERT SQL Server.
 */
export const previewDestinationPublishHtmlResponseSchema = z.object({
  html: z.string(),
  addedLinks: z.array(addedLinkSchema),
});
export type PreviewDestinationPublishHtmlResponse = z.infer<
  typeof previewDestinationPublishHtmlResponseSchema
>;

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

/** Bao cao tinh lai bang dichoithoi_cluster_distances (relations-plan §1.2, Giai doan A2) */
export const recomputeClusterDistancesReportSchema = z.object({
  /** So node cap tinh/cum (kind IN province,cluster) co lat/lng dung de tinh */
  nodes: z.number().int(),
  /** So cap khoang cach da ghi (toi da C(nodes,2)) */
  pairs: z.number().int(),
  /** So cap ORS khong tra ve duoc khoang cach duong bo (null/khong tim thay
   * tuyen) — CHU DINH KHONG ghi 0 cho cac cap nay (dichoithoi-poi-distance-plan.md
   * Giai doan 5), bo qua thay vi ghi sai du lieu. */
  failedPairs: z.number().int(),
  durationMs: z.number().int(),
});
export type RecomputeClusterDistancesReport = z.infer<
  typeof recomputeClusterDistancesReportSchema
>;

/**
 * Bao cao tinh khoang cach duong bo that (OpenRouteService) cho 1 cum/tinh —
 * dichoithoi-poi-distance-plan.md Giai doan 2. Ghi ca DistanceFromCenter (con->
 * cha) lan poi_distances (con<->con), full recompute moi lan chay.
 */
export const recomputeGroupDistancesReportSchema = z.object({
  parentSlug: z.string(),
  /** So con published co toa do dung de tinh */
  children: z.number().int(),
  /** So cap con<->con da ghi (toi da C(children,2)) */
  pairs: z.number().int(),
  durationMs: z.number().int(),
});
export type RecomputeGroupDistancesReport = z.infer<typeof recomputeGroupDistancesReportSchema>;

/**
 * Bao cao tinh khoang cach duong bo that cho 1 diem theo ban kinh vat ly —
 * dichoithoi-poi-distance-plan.md Giai doan 3. Tu dong goi lai RelatedJson cho
 * diem nay ngay sau khi ghi xong.
 */
export const recomputeNearbyDistancesReportSchema = z.object({
  slug: z.string(),
  /** So ung vien gan (Haversine, ban kinh 30km) duoc dung de goi ORS */
  candidates: z.number().int(),
  /** RelatedJson cua diem nay co thay doi sau khi tinh lai khong */
  relatedUpdated: z.boolean(),
  durationMs: z.number().int(),
});
export type RecomputeNearbyDistancesReport = z.infer<typeof recomputeNearbyDistancesReportSchema>;

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
  /** Full URL tung anh trong `gallery`, cung thu tu — de FE hien preview khong can tu ghep base */
  galleryImageUrls: z.array(z.string().nullable()),
  /** Trang thai job ai-content dang chay (neu co) — de hien link dung cho */
  activeJobStatus: z.string().nullable(),
  /**
   * Job ai-content GAN NHAT cho diem nay theo sourceRef (co the KHAC
   * activeContentJobId — publish clear activeContentJobId nhung job cu van
   * con draft; neu nguoi dung bam "Retry" o trang /content chung sau khi da
   * publish, job do khong tu relink lai activeContentJobId). Field nay CHI
   * dung de FE nap goi y AI/hien status AI, KHONG dung cho cac gate chan
   * "dang co job dang chay" (van phai dung activeContentJobId, bug 07/2026).
   */
  latestContentJobId: z.string().nullable(),
  /**
   * Ban nhap bai viet (tieu de/intro/6 block/FAQ/quickFacts/metadata) — pivot
   * gop editor vao trang detail. Raw object CHUA chac hop le du du lieu (dang
   * soan dat do) — FE tu parse theo DestinationArticle; validate that chi chay
   * o gate-check/preview/publish. null = chua co ban nhap nao.
   */
  draftArticle: z.record(z.string(), z.unknown()).nullable(),
  /** Noi dung hien tai tren web — null khi chua co bai hoac chua ket noi SQL Server */
  content: destinationSiteContentSchema.nullable(),
  /** Thong tin nguoi dung da luu cho AI (tu dien lai form viet bai) */
  aiNotes: z.string().nullable(),
  aiReferenceUrls: z.array(referenceUrlSchema),
  /** Gio mo cua chuan hoa — chi ghi qua buoc "Chap nhan" trich xuat AI (§2.2) */
  openingHours: destinationOpeningHoursSchema.nullable(),
  /** Tom tat nguon tham khao — dung thay fetch tung URL khi tao job (§2.2) */
  aiReferenceSummary: z.string().nullable(),
  aiReferenceSummaryUpdatedAt: z.string().nullable(),
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
  /** Link Google Maps nhap tay — server tu parse lat/lng tu day, khong nhan lat/lng truc tiep nua */
  googleMapsUrl: z.string().max(500).nullable().optional(),
  addressNew: z.string().max(256).nullable().optional(),
  addressOld: z.string().max(256).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  contactWebsite: z.string().max(256).nullable().optional(),
  hotelGroupId: z.string().max(50).nullable().optional(),
  priority: z.number().int().min(1).max(5).optional(),
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
  googleMapsUrl: z.string().max(500).nullable().optional(),
  addressNew: z.string().max(256).nullable().optional(),
  addressOld: z.string().max(256).nullable().optional(),
  contactPhone: z.string().max(32).nullable().optional(),
  contactWebsite: z.string().max(256).nullable().optional(),
  hotelGroupId: z.string().max(50).nullable().optional(),
  priority: z.number().int().min(1).max(5).optional(),
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

/**
 * Sua nhanh nhieu diem den cung luc qua export/import CSV (Google Sheet) — CHI
 * field lien he/tham khao, khong dong field cau truc (kind/parentSlug/
 * provinceCode/priority/contentTier — doi sai co the gay tac dung phu tinh
 * lai quan he cha-con/related). Khop theo slug, KHONG tao moi (khac import
 * thuong o tren) — slug khong ton tai la loi.
 */
export const DESTINATION_BULK_EDIT_FIELD_KEYS = [
  "googleMapsUrl",
  "addressNew",
  "addressOld",
  "contactPhone",
  "contactWebsite",
  "hotelGroupId",
  "shortDescription",
  "metaTitle",
  "facebookUrl",
  "tripadvisorUrl",
  "priority",
] as const;
export type DestinationBulkEditFieldKey = (typeof DESTINATION_BULK_EDIT_FIELD_KEYS)[number];

export const DESTINATION_BULK_EDIT_FIELD_LABELS: Record<DestinationBulkEditFieldKey, string> = {
  googleMapsUrl: "Link Google Maps",
  addressNew: "Địa chỉ mới (sau sáp nhập)",
  addressOld: "Địa chỉ cũ (trước sáp nhập)",
  contactPhone: "Điện thoại liên hệ",
  contactWebsite: "Website chính thức",
  hotelGroupId: "Nhóm khách sạn (hotelGroupId)",
  shortDescription: "Mô tả ngắn",
  metaTitle: "Meta Title (thẻ <title> SEO)",
  facebookUrl: "Link Facebook",
  tripadvisorUrl: "Link TripAdvisor",
  priority: "Độ ưu tiên (1-5, 1=cao nhất)",
};

/** Nhan co dinh dung de khop/ghi entry trong externalReviewUrls khi bulk-edit facebookUrl/tripadvisorUrl. */
export const DESTINATION_BULK_EDIT_REVIEW_LABELS: Record<"facebookUrl" | "tripadvisorUrl", string> = {
  facebookUrl: "Facebook",
  tripadvisorUrl: "TripAdvisor",
};

/** Query cho GET /destinations/export — filter giong list (tru sort/phan trang, luon xuat het). */
export const exportDestinationsQuerySchema = z.object({
  /** Comma-separated DestinationBulkEditFieldKey, vd "googleMapsUrl,contactPhone" */
  fields: z.string().min(1),
  q: z.string().optional(),
  provinceCode: z.string().optional(),
  parentSlug: z.string().optional(),
  kind: destinationKindSchema.optional(),
  contentState: destinationContentStateSchema.optional(),
  production: destinationProductionStateSchema.optional(),
});
export type ExportDestinationsQuery = z.infer<typeof exportDestinationsQuerySchema>;

export const destinationBulkEditRowSchema = z.object({
  slug: z.string().min(1).max(64),
  googleMapsUrl: z.string().max(500).optional(),
  addressNew: z.string().max(256).optional(),
  addressOld: z.string().max(256).optional(),
  contactPhone: z.string().max(32).optional(),
  contactWebsite: z.string().max(256).optional(),
  hotelGroupId: z.string().max(50).optional(),
  shortDescription: z.string().max(1000).optional(),
  metaTitle: z.string().max(DESTINATION_FIELD_LIMITS.metaTitle).optional(),
  facebookUrl: z.string().max(1024).optional(),
  tripadvisorUrl: z.string().max(1024).optional(),
  /** Chuoi tu CSV, phai la so nguyen 1-5 neu co gia tri — validate trong usecase
   * (khong ep kieu o schema vi CSV luon la text, o rong = khong doi). */
  priority: z.string().max(4).optional(),
});
export type DestinationBulkEditRow = z.infer<typeof destinationBulkEditRowSchema>;

export const bulkUpdateDestinationFieldsRequestSchema = z.object({
  items: z.array(destinationBulkEditRowSchema).min(1).max(1000),
});
export type BulkUpdateDestinationFieldsRequest = z.infer<
  typeof bulkUpdateDestinationFieldsRequestSchema
>;

export const bulkUpdateDestinationFieldsResultSchema = z.object({
  updated: z.number().int(),
  errors: z.array(z.object({ row: z.number().int(), slug: z.string(), message: z.string() })),
});
export type BulkUpdateDestinationFieldsResult = z.infer<
  typeof bulkUpdateDestinationFieldsResultSchema
>;

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

/** Cap nhat danh gia bien tap — sau khi nguoi dung duyet/sua ban AI goi y (Phase 28.0) */
export const updateEditorialReviewRequestSchema = z.object({
  editorialReview: z.string().max(500).nullable(),
});
export type UpdateEditorialReviewRequest = z.infer<typeof updateEditorialReviewRequestSchema>;

/** Ket qua AI goi y danh gia bien tap (chua luu) */
export const suggestEditorialReviewResponseSchema = z.object({
  suggestion: z.string(),
});

/**
 * Cap nhat metaTitle thu cong tu trang chi tiet (them ben canh duong bulk-edit
 * CSV) — cung 2 buoc ghi voi BulkUpdateDestinationFieldsUseCase (mirror +
 * DestinationContent), KHONG dong cham draftArticle.metadata.metaTitle cua AI.
 */
export const updateMetaTitleRequestSchema = z.object({
  metaTitle: z.string().max(DESTINATION_FIELD_LIMITS.metaTitle).nullable(),
});
export type UpdateMetaTitleRequest = z.infer<typeof updateMetaTitleRequestSchema>;
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

/**
 * Tach lat/lng tu link Google Maps (spec destination-spec §2.1.1) — dung NOI BO
 * boi UpsertDestinationUseCase/ImportDestinationsUseCase (server tu parse lai
 * moi lan googleMapsUrl doi), khong con endpoint HTTP rieng cho FE goi truc tiep.
 */
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
 * 1 diem den tren trang ban do tong quan CMS (relations-plan §5.1-5.2, Giai doan A4) —
 * DTO nhe, chi cac field can cho marker/popup, KHONG phai destinationMirrorSchema day du.
 * Chua co field "loai hinh" (primaryType) — taxonomy chua duoc mirror hoa sang Postgres,
 * se them khi Giai doan C1 xong (§1.4 muc 1).
 */
export const destinationMapItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  kind: destinationKindSchema,
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  imageUrl: z.string().nullable(),
  siteId: z.number().int().nullable(),
  siteStatus: z.number().int().min(0).max(2).nullable(),
  contentTier: destinationContentTierSchema.nullable(),
  provinceCode: z.string().nullable(),
  provinceName: z.string().nullable(),
  /** Cum/tinh cha truc tiep — dung ve duong noi len tam cum khi bat lop quan
   * he (relations-plan §5.2, Giai doan C4). */
  parentSlug: z.string().nullable(),
});
export type DestinationMapItem = z.infer<typeof destinationMapItemSchema>;

export const getDestinationsMapResponseSchema = z.object({
  items: z.array(destinationMapItemSchema),
});
export type GetDestinationsMapResponse = z.infer<typeof getDestinationsMapResponseSchema>;

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
