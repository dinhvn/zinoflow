import type { DestinationArticle } from "@zinoflow/contracts";
import { CULTURAL_STORY_HEADING_KEYWORDS, SEASON_HEADING_KEYWORDS } from "./destination-gates";
import { containsNormalized } from "./text-matching";

/**
 * Trich xuat doan van co RUI RO TRUNG LAP CAO nhat trong 1 bai diem den, dung
 * lam input cho gate "originality" (so trigram voi bai khac cung tinh) — KHONG
 * so nguyen draftMarkdown vi bang gia/gio mo cua/FAQ deu co cau truc giong
 * nhau tu nhien giua cac diem den, se gay false-positive cao.
 *
 * Gom: mo bai (de bi lap cong thuc gioi thieu) + section "cau chuyen van hoa -
 * lich su" (thuong/POI) hoac "mua/thoi diem dep" (Flagship) neu co — dung 2
 * bo tu khoa da co san o structure gate de tim dung section.
 *
 * Khong gom "luu y thuc te" (PracticalNotesJson) vi field do thuoc form sua
 * metadata diem den, ngoai pham vi DestinationArticle ma content job dang xu
 * ly — de mo rong sau neu can.
 */
export function extractOriginalityExcerpt(article: DestinationArticle): string {
  const parts: string[] = [article.intro];

  const riskySection = article.sections.find((section) =>
    [...CULTURAL_STORY_HEADING_KEYWORDS, ...SEASON_HEADING_KEYWORDS].some((kw) =>
      containsNormalized(section.heading, kw),
    ),
  );
  if (riskySection) {
    parts.push(riskySection.content);
  }

  return parts.join("\n\n").trim();
}
