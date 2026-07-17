import { z } from "zod/v4";

/**
 * Thu vien anh noi dung (dichoithoi-content-image-library-plan.md §3.1) — doc lap
 * hoan toan khoi anh hero/thumb/gallery cua diem den. Postgres-only, KHONG mirror
 * SQL Server (Article/Destination resolve token thanh HTML that luc publish, site
 * khong can biet bang nay). status "pending" danh cho nguon tu dong tim anh sau nay
 * (dichoithoi-auto-image-search-plan.md) — chua dung o Muc A, nhung field co san.
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
