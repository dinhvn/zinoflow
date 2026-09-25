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
  /** Link tu muc "Ket qua tren web" tren trang Google Maps cua dia diem (co the rong) */
  webResultUrls: Array<{ label: string; url: string }>;
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
  /**
   * `quickOnly` (mac dinh false): neu Google tra ve trang DANH SACH nhieu ket
   * qua (>2, that su mo ho, can ghe tung trang moi biet), BO QUA NGAY (nem
   * AmbiguousResultsSkippedError) thay vi ghe lan luot toi da 5 trang. 2 ket
   * qua van xu ly binh thuong (thuong 1 trong 2 la dung, khong dang bo qua)
   * — chi bo qua khi that su mo ho, tiet kiem thoi gian khi chay batch lon,
   * uu tien xong het cac diem de truoc, diem mo ho de lai cho lan chay sau.
   */
  searchText(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
    quickOnly?: boolean,
  ): Promise<PlaceTextSearchResult[]>;

  /**
   * Lay lai snapshot TUOI cho 1 placeId da biet (Place Details). KHONG con
   * dung o luong Chap nhan candidate nua (staging da luu du du lieu can, xem
   * AcceptGeocodeCandidatesUseCase) — giu lai cho truong hop can lam moi thu
   * cong 1 diem cu the trong tuong lai. Tra null neu Google khong con tim
   * thay place nay (vd bi xoa/gop).
   */
  getDetails(
    placeId: string,
    options?: { skipWebResults?: boolean },
  ): Promise<PlaceTextSearchResult | null>;

  /**
   * Tim kiem RE, CHI doc ten tu URL cua trang danh sach (khong ghe tung trang
   * ung vien) — dung cho ProcessGeocodeBatchUseCase cham AI khi Google ra
   * nhieu ket qua (yeu cau 10/08/2026), tranh phai mo het moi ung vien nhu
   * searchText(). `href` la placeId de goi getDetails() sau khi AI chon.
   */
  searchTextList(
    query: string,
    locationBias?: { lat: number; lng: number; radiusMeters: number },
  ): Promise<Array<{ href: string; name: string }>>;
}
