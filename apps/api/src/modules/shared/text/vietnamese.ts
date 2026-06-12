/**
 * Helper xu ly tieng Viet dung chung giua cac module (ai-content, destination).
 * Thuan TS, khong framework.
 */

/** "Túi Xách Nữ" -> "tui xach nu" — bo dau + lowercase + gon khoang trang. */
export function normalizeVietnamese(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // bo dau
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}
