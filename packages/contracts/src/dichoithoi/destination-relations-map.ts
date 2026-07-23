import { z } from "zod/v4";

/**
 * Lop quan he tren trang ban do (relations-plan §5.3-§5.7, Giai doan C4).
 * Nen (luon co khi bat toggle): khoang cach cum/tinh tu dong tinh (Giai doan
 * A2) + quan he curated tay. Spotlight (khi click 1 diem): RelatedJson that
 * da tinh san (Giai doan C2), khong tinh lai.
 */
export const clusterDistancePairSchema = z.object({
  clusterASlug: z.string(),
  clusterBSlug: z.string(),
  distanceMeters: z.number().int(),
});
export type ClusterDistancePairDto = z.infer<typeof clusterDistancePairSchema>;

export const curatedRelationPairSchema = z.object({
  sourceSlug: z.string(),
  targetSlug: z.string(),
});
export type CuratedRelationPairDto = z.infer<typeof curatedRelationPairSchema>;

/** Khoang cach duong bo that con↔con cung cum/tinh (dichoithoi_poi_distances,
 * dichoithoi-poi-distance-plan.md) — dung cho lop quan he "map-cluster-view-plan"
 * Giai doan D, chi ve khi da chon 1 cum/tinh cu the (xem map-cluster-view-plan.md). */
export const poiDistancePairSchema = z.object({
  poiASlug: z.string(),
  poiBSlug: z.string(),
  distanceMeters: z.number().int(),
});
export type PoiDistancePairDto = z.infer<typeof poiDistancePairSchema>;

export const getRelationsMapDataResponseSchema = z.object({
  clusterDistances: z.array(clusterDistancePairSchema),
  curatedRelations: z.array(curatedRelationPairSchema),
  poiDistances: z.array(poiDistancePairSchema),
});
export type GetRelationsMapDataResponse = z.infer<typeof getRelationsMapDataResponseSchema>;

/** 1 muc trong RelatedJson that da tinh san (khong tinh lai) — cho lop spotlight */
export const relatedSpotlightItemSchema = z.object({
  slug: z.string(),
  name: z.string(),
  badge: z.string().nullable(),
});
export type RelatedSpotlightItem = z.infer<typeof relatedSpotlightItemSchema>;

export const getRelatedSpotlightResponseSchema = z.object({
  items: z.array(relatedSpotlightItemSchema),
});
export type GetRelatedSpotlightResponse = z.infer<typeof getRelatedSpotlightResponseSchema>;

const relationActionSchema = z.enum(["add", "remove"]);

/** Noi/xoa quan he curated tay giua 2 diem bat ky (§5.7 muc 1-2) — ghi CA 2 CHIEU */
export const manageCuratedRelationRequestSchema = z.object({
  sourceSlug: z.string(),
  targetSlug: z.string(),
  action: relationActionSchema,
});
export type ManageCuratedRelationRequest = z.infer<typeof manageCuratedRelationRequestSchema>;

/** Loai tru 1 goi y tu dong (nearby/cung loai) khoi RelatedJson cua self (§5.7 muc 3) — 1 CHIEU */
export const manageExcludedRelationRequestSchema = z.object({
  sourceSlug: z.string(),
  targetSlug: z.string(),
  action: relationActionSchema,
});
export type ManageExcludedRelationRequest = z.infer<typeof manageExcludedRelationRequestSchema>;
