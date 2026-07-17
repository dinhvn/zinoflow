/**
 * Sinh tu khoa tim anh minh hoa CHUNG tu tieu de/chu de bai viet — thuan
 * chuoi, KHONG goi AI (auto-image-search-plan §2.2, quyet dinh 16/07/2026:
 * giu don gian truoc, chap nhan tu khoa co the chua chuan de doi lay chi phi
 * = 0, nguoi dung loc lai bang mat o man duyet).
 *
 * Bo tu chi dia danh/loai bai thuong gap ("kinh nghiem", "review", "top",
 * so...) de tranh tu khoa qua he thong/it ra ket qua anh dep; giu lai phan
 * con lai lam tu khoa tim anh.
 */
const STOP_WORDS = new Set([
  "kinh", "nghiem", "review", "top", "cac", "nhung", "danh", "sach",
  "gia", "re", "tot", "nhat", "nen", "di", "choi", "o", "tai", "cho",
]);

// U+0300-036F = Combining Diacritical Marks — con lai sau NFD normalize
const COMBINING_MARKS_RE = /[̀-ͯ]/g;

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(COMBINING_MARKS_RE, "").replace(/đ/g, "d").replace(/Đ/g, "D");
}

export function generateSearchKeyword(topic: string): string {
  const words = stripDiacritics(topic.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));

  const keyword = words.length > 0 ? words.join(" ") : stripDiacritics(topic.toLowerCase()).trim();
  return `${keyword} vietnam travel`;
}
