import { z } from "zod/v4";
import { affiliateLinkStatusSchema } from "./affiliate";

/**
 * Contracts cho module San pham (dichoithoi-product-spec.md) — affiliate dung
 * chung nhung KHONG gan theo dia ly nhu Hotel/Tour, chi ghep noi qua `tags` khi
 * chen khoi dong `[[block:products tag=...]]` vao bai viet. Postgres-only,
 * KHONG dong bo SQL Server — compile thang vao ContentHtml luc publish bai.
 */

export const productSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(256),
  /** 1 gia tri co kiem soat — dung de duyet/loc man quan ly, KHONG dung de match trong bai */
  category: z.string().min(1).max(64),
  /** Nhieu gia tri tu do — dung de match voi tham so tag= trong token chen bai */
  tags: z.array(z.string().min(1).max(64)),
  thumbnailUrl: z.string().max(512).nullable(),
  price: z.number().nullable(),
  provider: z.string().max(64).nullable(),
  sourceUrl: z.url().max(512),
  affiliateUrl: z.string().max(512).nullable(),
  linkStatus: affiliateLinkStatusSchema,
  /** 0 nhap tay, 1 cao — spec §5 */
  source: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Product = z.infer<typeof productSchema>;

export const upsertProductRequestSchema = z.object({
  name: z.string().min(1).max(256),
  category: z.string().min(1).max(64),
  tags: z.array(z.string().min(1).max(64)).max(20).optional(),
  thumbnailUrl: z.string().max(512).nullable().optional(),
  price: z.number().nonnegative().nullable().optional(),
  sourceUrl: z.url().max(512),
});
export type UpsertProductRequest = z.infer<typeof upsertProductRequestSchema>;

/**
 * Import hang loat tu Google Sheet (product-spec §5.1 — CHOT 07/2026). KHAC
 * Hotel/Tour: chi UPSERT theo `sourceUrl` (khong co khoa phu ten+tinh — spec
 * chi ap dung fallback nay cho Hotel/Tour, san pham khong co dia ly de gan,
 * trung ten khong du chac chan de tu goi y gop).
 */
export const productImportRowSchema = upsertProductRequestSchema;
export type ProductImportRow = UpsertProductRequest;

export const importProductsRequestSchema = z.object({
  items: z.array(productImportRowSchema).min(1).max(500),
  dryRun: z.boolean().optional().default(false),
});
export type ImportProductsRequest = z.infer<typeof importProductsRequestSchema>;

export const importProductRowResultSchema = z.object({
  sourceUrl: z.string(),
  name: z.string(),
  action: z.enum(["create", "update"]),
  matchedId: z.string().nullable(),
  applied: z.boolean(),
  error: z.string().nullable(),
});
export type ImportProductRowResult = z.infer<typeof importProductRowResultSchema>;

export const importProductsResultSchema = z.object({
  dryRun: z.boolean(),
  created: z.number().int(),
  updated: z.number().int(),
  errors: z.number().int(),
  rows: z.array(importProductRowResultSchema),
});
export type ImportProductsResult = z.infer<typeof importProductsResultSchema>;
