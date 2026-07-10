import { z } from "zod/v4";
import { affiliateLinkStatusSchema } from "./affiliate";

/**
 * Contracts cho module tour — khoi goi y tren trang diem den (KHONG co trang
 * rieng, khong qua 2 chot duyet), giong Hotel nhung 1 tour co the gan NHIEU
 * diem den. Spec: dichoithoi-tour-spec.md.
 */

export const tourSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(256),
  shortDescription: z.string().max(500).nullable(),
  durationDays: z.number().int().nullable(),
  durationNights: z.number().int().nullable(),
  departureFrom: z.string().max(256).nullable(),
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
  source: z.number().int().min(0),
  siteId: z.number().int().nullable(),
  destinationCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Tour = z.infer<typeof tourSchema>;

export const upsertTourRequestSchema = z.object({
  name: z.string().min(1).max(256),
  shortDescription: z.string().max(500).nullable().optional(),
  durationDays: z.number().int().nonnegative().nullable().optional(),
  durationNights: z.number().int().nonnegative().nullable().optional(),
  departureFrom: z.string().max(256).nullable().optional(),
  provinceCode: z.string().max(2).nullable().optional(),
  priceFrom: z.number().nonnegative().nullable().optional(),
  rating: z.number().min(0).max(10).nullable().optional(),
  reviewCount: z.number().int().nonnegative().nullable().optional(),
  thumbnailUrl: z.string().max(512).nullable().optional(),
  images: z.array(z.string().max(512)).max(20).optional(),
  provider: z.string().max(64).nullable().optional(),
  sourceUrl: z.url().max(512),
});
export type UpsertTourRequest = z.infer<typeof upsertTourRequestSchema>;

/**
 * Import hang loat tu Google Sheet (tour-spec §5, dung chung co che
 * product-spec §5.1 — CHOT 07/2026). Cung dang voi Hotel.
 */
export const tourImportRowSchema = upsertTourRequestSchema;
export type TourImportRow = UpsertTourRequest;

export const importToursRequestSchema = z.object({
  items: z.array(tourImportRowSchema).min(1).max(500),
  dryRun: z.boolean().optional().default(false),
  confirmMergeIds: z.record(z.string(), z.string()).optional(),
});
export type ImportToursRequest = z.infer<typeof importToursRequestSchema>;

export const importTourRowResultSchema = z.object({
  sourceUrl: z.string(),
  name: z.string(),
  action: z.enum(["create", "update", "needsConfirm"]),
  matchedId: z.string().nullable(),
  reason: z.string().nullable(),
  applied: z.boolean(),
  error: z.string().nullable(),
});
export type ImportTourRowResult = z.infer<typeof importTourRowResultSchema>;

export const importToursResultSchema = z.object({
  dryRun: z.boolean(),
  created: z.number().int(),
  updated: z.number().int(),
  needsConfirm: z.number().int(),
  errors: z.number().int(),
  rows: z.array(importTourRowResultSchema),
});
export type ImportToursResult = z.infer<typeof importToursResultSchema>;

/** Gan/go 1 tour khoi 1 diem den (tour-spec §3 tour_destination_map) */
export const assignTourRequestSchema = z.object({
  destinationSlug: z.string().min(1).max(64),
  isPrimary: z.boolean().optional(),
});
export type AssignTourRequest = z.infer<typeof assignTourRequestSchema>;
