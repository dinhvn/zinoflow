import type { PlaceBusinessStatus } from "@zinoflow/contracts";

/**
 * Port Google Places API (New) — dichoithoi-destination-geocode-audit-plan.md
 * Giai doan 0. Implementation: infrastructure/geocoding/google-places.provider.ts.
 */
export const PLACE_GEOCODING_PROVIDER = Symbol("PLACE_GEOCODING_PROVIDER");

/** Tier field mask — anh huong quota rieng (Pro 5000 free/thang, Enterprise 1000 free/thang) */
export type PlacesApiTier = "pro" | "enterprise";

export interface PlaceTextSearchResult {
  placeId: string;
  displayName: string;
  formattedAddress: string | null;
  lat: number;
  lng: number;
  googleMapsUri: string | null;
  businessStatus: PlaceBusinessStatus | null;
  nationalPhoneNumber: string | null;
  websiteUri: string | null;
  rating: number | null;
  userRatingCount: number | null;
  photoNames: string[];
}

export interface PlaceGeocodingProvider {
  /** false khi thieu GOOGLE_MAPS_API_KEY trong env */
  isConfigured(): boolean;
  /**
   * Tim theo van ban tu do, uu tien ket qua gan `locationBias` neu co (tam +
   * ban kinh met). Field mask co dinh Pro+Enterprise (da chot lay ca 2 ngay
   * dot dau). Nem UpstreamApiError neu goi API loi; ghi 1 dong usage log
   * (qua PLACES_API_USAGE_RECORDER) cho MOI lan goi thanh cong, bat ke co
   * ket qua hay khong.
   */
  searchText(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
  ): Promise<PlaceTextSearchResult[]>;

  /**
   * Lay lai snapshot TUOI cho 1 placeId da biet (Place Details) — dung khi
   * Chap nhan 1 candidate da tim tu truoc (staging chi luu placeId, khong luu
   * noi dung — xem chinh sach luu tru trong contracts geocode.ts). Tra null
   * neu Google khong con tim thay place nay (vd bi xoa/gop).
   */
  getDetails(placeId: string): Promise<PlaceTextSearchResult | null>;
}
