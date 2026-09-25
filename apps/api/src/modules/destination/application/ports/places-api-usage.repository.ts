/**
 * Port dem so lan quet Google Maps (qua PlaywrightGoogleMapsProvider) trong
 * thang lich hien tai — dung chung cho ca che do tung diem (1a) va hang loat
 * (1b). Chi con la thong ke tham khao (khong con gioi han/chan gi — chuyen tu
 * Google Places API sang scrape, khong con quota/billing that, xem memory
 * dichoithoi-destination-geocode-audit-plan-open.md).
 */
export const PLACES_API_USAGE_REPOSITORY = Symbol("PLACES_API_USAGE_REPOSITORY");

export interface PlacesApiUsageRepository {
  record(): Promise<void>;
  countThisMonth(): Promise<number>;
}
