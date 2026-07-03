/**
 * Formatter dung chung cho Player (preview) + worker (export) — spec §19.1.
 * Tach o day de UI va render KHONG tu format rieng (tranh lech hien thi).
 */

/** Format gia VND: 1250000 -> "1.250.000đ". null/0 -> "". */
export function formatPriceVnd(value: number | null | undefined): string {
  if (value == null || value <= 0) return "";
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

/** Badge giam gia: 30 -> "-30%". null/0 -> "". */
export function formatDiscountPercent(percent: number | null | undefined): string {
  if (percent == null || percent <= 0) return "";
  return `-${Math.round(percent)}%`;
}

/**
 * Tinh % giam tu gia goc + gia ban khi CMS khong tra san.
 * Tra null neu thieu du lieu hoac khong giam.
 */
export function computeDiscountPercent(
  originalPrice: number | null | undefined,
  salePrice: number | null | undefined,
): number | null {
  if (!originalPrice || !salePrice || salePrice >= originalPrice) return null;
  return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
}
