/**
 * Helper so khop text cho quality gates — thuan TS, khong framework.
 * So khop KHONG phan biet dau tieng Viet va hoa/thuong de gate khong fail oan
 * khi keyword nhap khong dau nhung bai viet co dau (va nguoc lai).
 */

// normalizeVietnamese da chuyen len shared/text/vietnamese.ts (dung chung voi
// module destination) — re-export de giu nguyen API cua file nay.
export { normalizeVietnamese } from "../../../shared/text/vietnamese";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";

/** Kiem tra haystack co chua needle (khong phan biet dau/hoa thuong). */
export function containsNormalized(haystack: string, needle: string): boolean {
  return normalizeVietnamese(haystack).includes(normalizeVietnamese(needle));
}

/** Dem so tu (du cho rule do dai section §17.3). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
