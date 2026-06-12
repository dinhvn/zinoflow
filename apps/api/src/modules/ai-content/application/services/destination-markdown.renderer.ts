import type { DestinationArticle } from "@zinoflow/contracts";

/**
 * Render bai DIEM DEN (guide-diem-den) thanh markdown cho editor/preview.
 * Quick facts render thanh khoi rieng dau bai — khi publish (Phase C) cac truong
 * nay do vao COT v2.DestinationContent, KHONG nam trong ContentHtml.
 * Pure function — test duoc va dung lai o export HTML.
 */
export function renderDestinationMarkdown(article: DestinationArticle): string {
  const lines: string[] = [];

  lines.push(`# ${article.title}`, "");
  lines.push(article.intro, "");
  lines.push(`> ${article.updateNotice}`, "");

  // Quick facts — hien thi de review tay (phan du lieu de sai nhat)
  lines.push("## Thông tin nhanh", "");
  lines.push(`- **Giờ mở cửa:** ${article.quickFacts.openingTime}`);
  lines.push(`- **Giá vé:** ${article.quickFacts.ticketPrice}`);
  lines.push(`- **Di chuyển:** ${article.quickFacts.transport}`);
  lines.push(`- **Ăn uống:** ${article.quickFacts.food}`);
  lines.push(`- **Lưu trú:** ${article.quickFacts.hotel}`);
  lines.push(`- **Mẹo & lưu ý:** ${article.quickFacts.tip}`, "");

  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, "");
    lines.push(section.content, "");
  }

  lines.push("## Câu hỏi thường gặp", "");
  for (const item of article.faq) {
    lines.push(`### ${item.question}`);
    lines.push(item.answer, "");
  }

  // metadata khong render — dung khi publish (MetaTitle/description/slug)
  return lines.join("\n");
}
