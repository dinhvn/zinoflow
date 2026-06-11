import type { Article } from "@zinoflow/contracts";

/**
 * Render bai viet 8-block thanh markdown — format theo spec §18.3.
 * Pure function (khong side effect) de test de dang va dung lai o export HTML.
 */
export function renderArticleMarkdown(article: Article): string {
  const lines: string[] = [];

  // Block 1 — Hero
  lines.push(`# ${article.hero.title}`, "");
  lines.push(`*${article.hero.subtitle}*`, "");
  lines.push(`> ${article.hero.affiliateDisclosure}`, "");

  // Block 2 — Intent
  lines.push("## Bài viết này dành cho ai?", "");
  lines.push(article.intent.forWho, "");
  lines.push(article.intent.problem, "");

  // Block 3 — Quick answer
  lines.push("## Trả lời nhanh", "");
  for (const bullet of article.quickAnswer.bullets) {
    lines.push(`- ${bullet}`);
  }
  lines.push("");

  // Block 4 — Main sections
  for (const section of article.sections) {
    lines.push(`## ${section.heading}`, "");
    lines.push(section.content, "");
  }

  // Block 5 — Product recommendations
  lines.push("## Top sản phẩm nổi bật", "");
  article.productRecommendations.forEach((p, index) => {
    lines.push(`### ${index + 1}) ${p.name}`);
    lines.push(`- **Vì sao có trong danh sách:** ${p.whyInList}`);
    lines.push(`- **Ưu điểm:** ${p.pros.join(", ")}`);
    lines.push(`- **Hạn chế:** ${p.cons.join(", ")}`);
    lines.push(`- **Giá tham khảo:** ${p.priceRange}`);
    lines.push(`- **Phù hợp với:** ${p.bestFor}`);
    lines.push(`- [Xem sản phẩm](${p.productUrl})`, "");
  });

  // Block 6 — FAQ
  lines.push("## Câu hỏi thường gặp", "");
  for (const item of article.faq) {
    lines.push(`### ${item.question}`);
    lines.push(item.answer, "");
  }

  // Block 7 — Final CTA
  lines.push("## Kết luận", "");
  lines.push(article.finalCta.text, "");
  lines.push(`**${article.finalCta.action}**`, "");

  // Block 8 (metadata) khong render vao noi dung — dung khi publish (metaTitle/slug)
  return lines.join("\n");
}
