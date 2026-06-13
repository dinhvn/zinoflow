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

/** "Núi Hàm Rồng" -> "nui-ham-rong" — slug URL (bo dau, ky tu khac -> gach ngang). */
export function slugifyVietnamese(text: string): string {
  return normalizeVietnamese(text)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
