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
