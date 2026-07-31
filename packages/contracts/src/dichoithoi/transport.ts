import { z } from "zod/v4";

/**
 * Contracts cho module Van chuyen (Ve xe khach mode=2, Ve may bay mode=1 du
 * phong sau) — gan theo TUYEN co diem dung (khong theo POI). Spec:
 * dichoithoi-transport-vexekhach-plan.md, dichoithoi-bus-spec.md.
 */

export const transportModeSchema = z.enum(["flight", "bus"]);
export type TransportMode = z.infer<typeof transportModeSchema>;

/**
 * converted/no-rule/manual-override giong Hotel/Tour; them 'no-link' — nhieu
 * nha xe nho chi co SDT, KHONG co link dat online de convert (khac "chua co
 * rule" — vo tinh khong co gi de rule).
 */
export const transportLinkStatusSchema = z.enum([
  "converted",
  "no-rule",
  "manual-override",
  "no-link",
]);
export type TransportLinkStatus = z.infer<typeof transportLinkStatusSchema>;

export const transportStopRoleSchema = z.enum(["origin", "destination", "waypoint"]);
export type TransportStopRole = z.infer<typeof transportStopRoleSchema>;

/** 1 diem dung trong tuyen — dung slug diem den that (kind cluster/province) */
export const transportStopSchema = z.object({
  destinationSlug: z.string().min(1).max(64),
  /** Ten diem den — chi de hien thi, khong ghi xuong DB (server tu tra lai tu slug) */
  destinationName: z.string().optional(),
  role: transportStopRoleSchema,
  /** Thu tu diem trung gian tren tuyen (0 cho origin/destination) */
  seqOrder: z.number().int().min(0).default(0),
});
export type TransportStop = z.infer<typeof transportStopSchema>;

export const transportSchema = z.object({
  id: z.string().uuid(),
  mode: transportModeSchema,
  operatorName: z.string().min(1).max(256),
  phone: z.string().max(32).nullable(),
  vehicleType: z.string().max(64).nullable(),
  priceFrom: z.number().nullable(),
  thumbnailUrl: z.string().max(512).nullable(),
  provider: z.string().max(64).nullable(),
  sourceUrl: z.url().max(512).nullable(),
  affiliateUrl: z.string().max(512).nullable(),
  linkStatus: transportLinkStatusSchema,
  /** 0 nhap tay, 1 cao vexere.com... */
  source: z.number().int().min(0),
  /** Id ben SQL Server sau khi publish; null = chua publish */
  siteId: z.number().int().nullable(),
  stops: z.array(transportStopSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Transport = z.infer<typeof transportSchema>;

export const upsertTransportRequestSchema = z.object({
  mode: transportModeSchema,
  operatorName: z.string().min(1).max(256),
  phone: z.string().max(32).nullable().optional(),
  vehicleType: z.string().max(64).nullable().optional(),
  priceFrom: z.number().nonnegative().nullable().optional(),
  thumbnailUrl: z.string().max(512).nullable().optional(),
  provider: z.string().max(64).nullable().optional(),
  /** Tuy chon — nhieu nha xe nho chi co SDT, khong co link dat online (khac Hotel bat buoc) */
  sourceUrl: z.url().max(512).nullable().optional(),
  /**
   * Dung DUNG 1 dong role=origin, DUNG 1 dong role=destination, 0..N
   * role=waypoint (thu tu theo seqOrder tang dan) — validate o use-case.
   */
  stops: z.array(transportStopSchema).min(2),
});
export type UpsertTransportRequest = z.infer<typeof upsertTransportRequestSchema>;
