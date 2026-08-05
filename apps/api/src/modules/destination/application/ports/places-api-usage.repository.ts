/**
 * Port dem so lan goi Google Places API trong thang lich hien tai — dung
 * chung cho ca che do tung diem (1a) va hang loat (1b) vi cung 1 quota
 * (dichoithoi-destination-geocode-audit-plan.md). Field mask gop Pro+
 * Enterprise trong 1 request nen MOI lan goi thanh cong deu tinh 1 don vi
 * (khong tach rieng pro/enterprise — xem ghi chu trong contracts geocode.ts).
 */
export const PLACES_API_USAGE_REPOSITORY = Symbol("PLACES_API_USAGE_REPOSITORY");

/** Free-tier Enterprise SKU cua Google Places (chot 05/08/2026) — canh bao o 800, chan han o 1000 */
export const PLACES_API_FREE_TIER_LIMIT = 1000;
export const PLACES_API_WARN_THRESHOLD = 800;

export interface PlacesApiUsageRepository {
  record(): Promise<void>;
  countThisMonth(): Promise<number>;
}
