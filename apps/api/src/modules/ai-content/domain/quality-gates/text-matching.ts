/**
 * Helper so khop text cho quality gates — thuan TS, khong framework.
 * So khop KHONG phan biet dau tieng Viet va hoa/thuong de gate khong fail oan
 * khi keyword nhap khong dau nhung bai viet co dau (va nguoc lai).
 */

/** "Túi Xách Nữ" -> "tui xach nu" */
export function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bo dau
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kiem tra haystack co chua needle (khong phan biet dau/hoa thuong). */
export function containsNormalized(haystack: string, needle: string): boolean {
  return normalizeVietnamese(haystack).includes(normalizeVietnamese(needle));
}

/** Dem so tu (du cho rule do dai section §17.3). */
export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}
