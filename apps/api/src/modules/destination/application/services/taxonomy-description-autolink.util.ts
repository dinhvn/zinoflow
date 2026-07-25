import { autoLinkContent, type LinkTarget } from "../../../shared/text/auto-link";
import { renderMarkdownToSafeHtml } from "./rich-markdown.renderer";

/**
 * Sinh DescriptionHtml tu Description dang Markdown cua 1 Type/Tag: parse Markdown ->
 * sanitize -> auto-link toi cac diem den DA GAN cho chinh Type/Tag do (khong phai toan
 * site — chi nhung diem thuc su xuat hien trong luoi hien thi cua trang, dung nguyen
 * tac "khong bia du lieu" da ap dung khi soan noi dung, xem
 * dichoithoi-nhom-type-tag-desc.md).
 *
 * Dung CHUNG pipeline Markdown voi than bai diem den (rich-markdown.renderer.ts) —
 * dong bo dinh dang tren toan module destination, nguoi dung yeu cau 25/07/2026 sau
 * khi thay 2 noi dung Type/Tag va bai diem den lech nhau (1 ben chi "markdown-lite",
 * 1 ben markdown day du). Khac 1 diem: `breaks: true` (1 lan Enter da xuong dong) vi
 * day la 1 doan gioi thieu ngan go trong textarea, khong phai bai dai chia section ro
 * rang nhu bai diem den (o do can dong trong CommonMark chuan de tach doan chu dinh).
 *
 * Description GOC (nguon sach, dung cho CMS textarea + meta fallback) KHONG bao gio
 * bi sua — ham nay chi TAO RA 1 gia tri moi de ghi rieng vao cot DescriptionHtml.
 *
 * @returns null khi description rong (khong con gi de hien thi/link).
 */
export function buildTaxonomyDescriptionHtml(
  description: string | null,
  targets: readonly LinkTarget[],
): string | null {
  const trimmed = description?.trim();
  if (!trimmed) return null;

  const safeHtml = renderMarkdownToSafeHtml(trimmed, { breaks: true });
  if (!safeHtml) return null;

  const { html } = autoLinkContent(safeHtml, targets, "");
  return html;
}
