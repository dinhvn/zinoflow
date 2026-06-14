import { z } from "zod/v4";
import { khuyenmaiSiteSchema } from "./cms-site";

/**
 * Mirror bai viet CMS khuyenmai (Postgres phan chieu bang WordpressPost SQL Server)
 * + query list cho man /laruki, /dochoi3s. Spec: laruki-dochoi3s-content-spec §3.2.
 */

/** Trang thai noi dung 1 bai trong AI tool */
export const cmsContentStateSchema = z.enum([
  "chua-co-bai", // chua co content AI (chi co ban goc tu CMS)
  "dang-soan", // co content job dang chay/cho duyet
  "da-ghi-cms", // da ghi content AI xuong CMS (FixedContent), chua publish
  "da-publish", // CMS da publish (DatePublished moi)
]);
export type CmsContentState = z.infer<typeof cmsContentStateSchema>;

/** 1 dong mirror tra ve UI */
export const cmsPostSchema = z.object({
  /** Id mirror (= WordpressPost.Id ben CMS) */
  cmsId: z.number().int(),
  site: khuyenmaiSiteSchema,
  /** PostId ben WordPress (0 = bai moi tao o AI tool, chua co WP post) */
  postId: z.number().int(),
  title: z.string(),
  link: z.string().nullable(),
  /** PostType int (CMS) — null neu chua phan loai */
  postType: z.number().int().nullable(),
  contentState: cmsContentStateSchema,
  isReadyAuto: z.boolean(),
  /** Job ai-content dang soan cho bai nay */
  activeContentJobId: z.string().nullable(),
  datePublished: z.string().nullable(),
  dateUpdated: z.string().nullable(),
});
export type CmsPost = z.infer<typeof cmsPostSchema>;

export const cmsPostSortBySchema = z.enum(["title", "postType", "contentState", "dateUpdated"]);
export type CmsPostSortBy = z.infer<typeof cmsPostSortBySchema>;

export const listCmsPostsQuerySchema = z.object({
  q: z.string().optional(),
  postType: z.coerce.number().int().optional(),
  contentState: cmsContentStateSchema.optional(),
  sortBy: cmsPostSortBySchema.default("dateUpdated"),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type ListCmsPostsQuery = z.infer<typeof listCmsPostsQuerySchema>;

export const listCmsPostsResponseSchema = z.object({
  items: z.array(cmsPostSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
});
export type ListCmsPostsResponse = z.infer<typeof listCmsPostsResponseSchema>;

/** POST /cms/:site/posts — tao bai MOI (INSERT shell PostId=0 ben CMS) */
export const createCmsPostRequestSchema = z.object({
  title: z.string().min(5).max(128),
  postType: z.number().int().optional(),
});
export type CreateCmsPostRequest = z.infer<typeof createCmsPostRequestSchema>;

export const createCmsPostResponseSchema = z.object({ cmsId: z.number().int() });
export type CreateCmsPostResponse = z.infer<typeof createCmsPostResponseSchema>;

/** Ket qua dong bo mirror tu CMS */
export const syncCmsPostsResultSchema = z.object({
  added: z.number().int(),
  updated: z.number().int(),
  unchanged: z.number().int(),
  durationMs: z.number(),
});
export type SyncCmsPostsResult = z.infer<typeof syncCmsPostsResultSchema>;

/** Chi tiet 1 bai (detail) — gom mirror + tag hien co + ghi chu AI da luu */
export const cmsPostDetailSchema = cmsPostSchema.extend({
  /** Cac tag [Type_Param:value] hien co trong FixedContent (chi doc, tham khao) */
  existingTags: z.array(z.string()),
  /** Trang thai job ai-content dang soan (null neu khong co) — UI mo nut "Ghi vao CMS" khi Approved */
  activeJobStatus: z.string().nullable(),
  aiNotes: z.string().nullable(),
  aiTagHints: z.string().nullable(),
  aiReferenceUrls: z.array(z.object({ label: z.string(), url: z.string() })),
});
export type CmsPostDetail = z.infer<typeof cmsPostDetailSchema>;
