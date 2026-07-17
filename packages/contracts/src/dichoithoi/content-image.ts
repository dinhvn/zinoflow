import { z } from "zod/v4";

/**
 * Thu vien anh noi dung (dichoithoi-content-image-library-plan.md §3.1) — doc lap
 * hoan toan khoi anh hero/thumb/gallery cua diem den. Postgres-only, KHONG mirror
 * SQL Server (Article/Destination resolve token thanh HTML that luc publish, site
 * khong can biet bang nay). status "pending" la anh do he thong tu dong tim
 * (dichoithoi-auto-image-search-plan.md §2.2) — chua duyet, khong hien trong
 * danh sach chon anh binh thuong cua editor.
 */
export const contentImageStatusValues = ["active", "pending"] as const;
export type ContentImageStatus = (typeof contentImageStatusValues)[number];

export const contentImageSchema = z.object({
  id: z.string(),
  imageUrl: z.string(),
  altText: z.string(),
  caption: z.string().nullable(),
  width: z.number().int(),
  height: z.number().int(),
  status: z.enum(contentImageStatusValues),
  usageCount: z.number().int(),
  uploadedAt: z.string(),
  /** null = upload tay. "pexels" = tu dong tim (auto-image-search-plan §1.1) */
  source: z.string().nullable(),
  sourceUrl: z.string().nullable(),
  photographer: z.string().nullable(),
  searchKeyword: z.string().nullable(),
  /** Bai cam nang da kich hoat tim anh nay — hien o man duyet §2.3 */
  relatedArticle: z.object({ jobId: z.string(), title: z.string() }).nullable(),
});
export type ContentImage = z.infer<typeof contentImageSchema>;

export const listContentImagesResponseSchema = z.object({
  images: z.array(contentImageSchema),
});
export type ListContentImagesResponse = z.infer<typeof listContentImagesResponseSchema>;

export const updateContentImageRequestSchema = z.object({
  altText: z.string().min(1, "Alt text khong duoc de trong"),
  caption: z.string().nullable(),
});
export type UpdateContentImageRequest = z.infer<typeof updateContentImageRequestSchema>;

/** Buoc "quet thieu anh" (auto-image-search-plan §2.1) — bai cam nang chua co token image nao */
export const articleMissingImageSchema = z.object({
  jobId: z.string(),
  title: z.string(),
});
export type ArticleMissingImage = z.infer<typeof articleMissingImageSchema>;

export const scanArticlesMissingImagesResponseSchema = z.object({
  articles: z.array(articleMissingImageSchema),
});
export type ScanArticlesMissingImagesResponse = z.infer<
  typeof scanArticlesMissingImagesResponseSchema
>;

/** Chay tim+tai+upload (pending) cho danh sach jobId da chon o man quet (§2.2) */
export const autoSearchContentImagesRequestSchema = z.object({
  jobIds: z.array(z.string()).min(1),
});
export type AutoSearchContentImagesRequest = z.infer<typeof autoSearchContentImagesRequestSchema>;

export const autoSearchArticleResultSchema = z.object({
  jobId: z.string(),
  title: z.string(),
  keyword: z.string(),
  stagedCount: z.number().int(),
  /** Ly do 0 anh: chua cau hinh PEXELS_API_KEY, khong tim thay ket qua, tat ca da bi tu choi truoc do... */
  note: z.string().nullable(),
});
export type AutoSearchArticleResult = z.infer<typeof autoSearchArticleResultSchema>;

export const autoSearchContentImagesResponseSchema = z.object({
  results: z.array(autoSearchArticleResultSchema),
});
export type AutoSearchContentImagesResponse = z.infer<
  typeof autoSearchContentImagesResponseSchema
>;
