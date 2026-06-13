/**
 * Port kiem tra anh diem den ton tai tren hosting (spec dichoithoi §14.3 — MVP).
 * Duong dan trong DB la TUONG DOI; full URL = DICHOITHOI_IMAGE_BASE_URL + path.
 * Implementation: infrastructure/reference/http-image-checker.ts.
 */
export const IMAGE_CHECKER = Symbol("IMAGE_CHECKER");

export interface ImageCheckResult {
  url: string;
  exists: boolean;
  /** HTTP status tu HEAD; 0 khi loi mang/timeout */
  status: number;
}

export interface ImageChecker {
  /** Ghep base URL + path roi HEAD request — khong nem, tra exists=false khi loi */
  check(path: string): Promise<ImageCheckResult>;
}
