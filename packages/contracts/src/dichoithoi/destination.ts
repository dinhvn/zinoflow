import { z } from "zod/v4";

/**
 * Contracts cho khu Dichoithoi (M4) — mirror diem den + sync.
 * Schema DB dich (SQL Server) xem docs/specs/dichoithoi-database-redesign.md;
 * mirror Postgres phan chieu metadata de UI list/filter + auto-link.
 */

/** Cap trong cay du lich: tinh -> cum/quan the -> diem (redesign §3.1) */
export const destinationKindSchema = z.enum(["province", "cluster", "poi"]);
export type DestinationKind = z.infer<typeof destinationKindSchema>;

/** Trang thai noi dung cua 1 diem den trong AI tool (UI cot quan trong nhat — spec §7.2) */
export const destinationContentStateSchema = z.enum([
  "chua-co-bai", // chua co noi dung
  "bai-tay", // co noi dung viet tay (ContentSource=0), chua qua AI tool
  "dang-soan", // co content job dang chay/cho duyet
  "da-publish", // bai AI da publish (ContentSource=1)
]);
export type DestinationContentState = z.infer<typeof destinationContentStateSchema>;

/** Co canh bao tu job dong bo mirror (spec §12.1) */
export const destinationSyncFlagSchema = z.enum(["edited-outside", "conflict", "orphan"]);
export type DestinationSyncFlag = z.infer<typeof destinationSyncFlagSchema>;

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
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  addressNew: z.string().nullable(),
  addressOld: z.string().nullable(),
  contactPhone: z.string().nullable(),
  contactWebsite: z.string().nullable(),
  bookingUrl: z.string().nullable(),
  hotelGroupId: z.string().nullable(),
  isFeatured: z.boolean(),
  /** 0 draft, 1 published, 2 hidden — theo cot Status SQL Server */
  siteStatus: z.number().int().min(0).max(2).nullable(),
  contentState: destinationContentStateSchema,
  /** Job ai-content dang soan cho diem nay — UI link sang man review */
  activeContentJobId: z.string().nullable(),
  syncFlags: z.array(destinationSyncFlagSchema),
  siteUpdatedAt: z.string().nullable(),
  syncedAt: z.string().nullable(),
});
export type DestinationMirror = z.infer<typeof destinationMirrorSchema>;

/** Query list diem den */
export const listDestinationsQuerySchema = z.object({
  q: z.string().optional(),
  provinceCode: z.string().optional(),
  kind: destinationKindSchema.optional(),
  contentState: destinationContentStateSchema.optional(),
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
  bookingUrl: z.string().max(512).nullable().optional(),
  hotelGroupId: z.string().max(50).nullable().optional(),
  isFeatured: z.boolean().optional(),
});
export type UpsertDestinationRequest = z.infer<typeof upsertDestinationRequestSchema>;

/** Cap nhat duong dan thumbnail cho 1 diem den (spec §14.3 — MVP) */
export const updateThumbnailRequestSchema = z.object({
  /** Duong dan TUONG DOI (vd "nui-ham-rong-sapa.webp" | "diem-den/{slug}/thumb.webp") */
  thumbnail: z.string().max(256).nullable(),
});
export type UpdateThumbnailRequest = z.infer<typeof updateThumbnailRequestSchema>;

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

/** Taxonomy cho form/filter */
export const destinationTaxonomySchema = z.object({
  provinces: z.array(
    z.object({ provinceCode: z.string(), name: z.string(), shortName: z.string() }),
  ),
  types: z.array(z.object({ id: z.number().int(), slug: z.string(), name: z.string() })),
});
export type DestinationTaxonomy = z.infer<typeof destinationTaxonomySchema>;
