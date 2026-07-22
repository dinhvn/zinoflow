/**
 * Port repository bang `dichoithoi_poi_distances` (dichoithoi-poi-distance-plan.md).
 * Implementation: infrastructure/repositories/typeorm-poi-distance.repository.ts.
 */
export const POI_DISTANCE_REPOSITORY = Symbol("POI_DISTANCE_REPOSITORY");

export interface PoiDistancePair {
  poiASlug: string;
  poiBSlug: string;
  distanceMeters: number;
}

export interface PoiDistanceRepository {
  findAll(): Promise<PoiDistancePair[]>;
  /**
   * Xoa MOI cap co it nhat 1 dau thuoc `slugs` roi ghi lai toan bo `pairs`
   * truyen vao — full recompute theo pham vi cum/tinh (Giai doan 2), KHONG
   * incremental (xem dichoithoi-poi-distance-plan.md ly do quyet dinh).
   */
  replaceAllForSlugs(slugs: readonly string[], pairs: readonly PoiDistancePair[]): Promise<void>;
  /**
   * Upsert tung cap rieng le, KHONG xoa cap khac ngoai `pairs` — dung cho pham
   * vi ban kinh vat ly linh hoat (Giai doan 3), khac Giai doan 2 vi ung vien
   * co the doi qua tung lan chay.
   */
  upsertPairs(pairs: readonly PoiDistancePair[]): Promise<void>;
}
