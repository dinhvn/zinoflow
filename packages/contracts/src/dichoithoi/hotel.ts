import { z } from "zod/v4";
import { affiliateLinkStatusSchema } from "./affiliate";

/**
 * Contracts cho module khach san — khoi goi y tren trang diem den (KHONG co
 * trang rieng, khong qua 2 chot duyet). Spec: dichoithoi-hotel-spec.md.
 */

export const hotelSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(256),
  address: z.string().max(512).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  provinceCode: z.string().max(2).nullable(),
  priceFrom: z.number().nullable(),
  rating: z.number().min(0).max(10).nullable(),
  reviewCount: z.number().int().nullable(),
  thumbnailUrl: z.string().max(512).nullable(),
  images: z.array(z.string()),
  provider: z.string().max(64).nullable(),
  sourceUrl: z.url().max(512),
  affiliateUrl: z.string().max(512).nullable(),
  linkStatus: affiliateLinkStatusSchema,
  /** 0 nhap tay, 1 cao booking.com, 2 cao agoda... — spec §3 */
  source: z.number().int().min(0),
  /** Id ben SQL Server sau khi publish; null = chua publish */
  siteId: z.number().int().nullable(),
  /** So diem den dang gan (map) — cho UI danh sach */
  destinationCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Hotel = z.infer<typeof hotelSchema>;

export const upsertHotelRequestSchema = z.object({
  name: z.string().min(1).max(256),
  address: z.string().max(512).nullable().optional(),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  provinceCode: z.string().max(2).nullable().optional(),
  priceFrom: z.number().nonnegative().nullable().optional(),
  rating: z.number().min(0).max(10).nullable().optional(),
  reviewCount: z.number().int().nonnegative().nullable().optional(),
  thumbnailUrl: z.string().max(512).nullable().optional(),
  images: z.array(z.string().max(512)).max(20).optional(),
  provider: z.string().max(64).nullable().optional(),
  sourceUrl: z.url().max(512),
});
export type UpsertHotelRequest = z.infer<typeof upsertHotelRequestSchema>;

/**
 * Import hang loat tu Google Sheet (hotel-spec §5, dung chung co che
 * product-spec §5.1 — CHOT 07/2026): 1 dong = 1 UpsertHotelRequest, khop
 * theo sourceUrl (khoa chinh) hoac ten+tinh chuan hoa (khoa phu, can xac nhan).
 */
export const hotelImportRowSchema = upsertHotelRequestSchema;
export type HotelImportRow = UpsertHotelRequest;

export const importHotelsRequestSchema = z.object({
  items: z.array(hotelImportRowSchema).min(1).max(500),
  /** true = chi phan tich + tra bao cao, KHONG ghi DB (man preview) */
  dryRun: z.boolean().optional().default(false),
  /**
   * Xac nhan gop rieng cho cac dong needsConfirm — key = sourceUrl cua dong
   * trong sheet, value = id ban ghi cu nguoi dung dong y gop vao. Dong nao
   * khong co trong day se BI BO QUA (khong tu dong ghi de) ke ca dryRun=false.
   */
  confirmMergeIds: z.record(z.string(), z.string()).optional(),
});
export type ImportHotelsRequest = z.infer<typeof importHotelsRequestSchema>;

export const importRowActionSchema = z.enum(["create", "update", "needsConfirm"]);
export type ImportRowActionKind = z.infer<typeof importRowActionSchema>;

export const importHotelRowResultSchema = z.object({
  sourceUrl: z.string(),
  name: z.string(),
  action: importRowActionSchema,
  matchedId: z.string().nullable(),
  reason: z.string().nullable(),
  /** true = da thuc su ghi DB (luon false khi dryRun, hoac needsConfirm chua duoc xac nhan) */
  applied: z.boolean(),
  error: z.string().nullable(),
});
export type ImportHotelRowResult = z.infer<typeof importHotelRowResultSchema>;

export const importHotelsResultSchema = z.object({
  dryRun: z.boolean(),
  created: z.number().int(),
  updated: z.number().int(),
  needsConfirm: z.number().int(),
  errors: z.number().int(),
  rows: z.array(importHotelRowResultSchema),
});
export type ImportHotelsResult = z.infer<typeof importHotelsResultSchema>;

/** Gan/go 1 khach san khoi 1 diem den (hotel-spec §3 hotel_destination_map) */
export const assignHotelRequestSchema = z.object({
  destinationSlug: z.string().min(1).max(64),
});
export type AssignHotelRequest = z.infer<typeof assignHotelRequestSchema>;

/** 1 dong khach san goi y hien tren trang diem den (card) */
export const hotelDestinationCardSchema = z.object({
  hotelId: z.string().uuid(),
  name: z.string(),
  thumbnailUrl: z.string().nullable(),
  priceFrom: z.number().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().int().nullable(),
  affiliateUrl: z.string().nullable(),
  distanceM: z.number().int().nullable(),
  isManual: z.boolean(),
});
export type HotelDestinationCard = z.infer<typeof hotelDestinationCardSchema>;
