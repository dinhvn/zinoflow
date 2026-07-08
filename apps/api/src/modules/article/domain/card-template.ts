/**
 * Template card HTML DUNG CHUNG cho khoi dong (dichoithoi-article-spec.md §5) —
 * KHONG de AI tu sinh markup, giu 1 "hop dong" markup co dinh khop CSS website
 * da style san cho card diem den/khach san/tour. Pure function, khong DB.
 */

export interface CardItem {
  href: string;
  name: string;
  thumbnailUrl: string | null;
  badge: string | null;
  meta: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderOneCard(item: CardItem): string {
  const img = item.thumbnailUrl
    ? `<img src="${escapeHtml(item.thumbnailUrl)}" alt="${escapeHtml(item.name)}" loading="lazy">`
    : "";
  const badge = item.badge ? `<span class="block-card__badge">${escapeHtml(item.badge)}</span>` : "";
  const meta = item.meta ? `<span class="block-card__meta">${escapeHtml(item.meta)}</span>` : "";
  return (
    `<a class="block-card" href="${escapeHtml(item.href)}">` +
    `${img}<span class="block-card__body">` +
    `<span class="block-card__name">${escapeHtml(item.name)}</span>${badge}${meta}` +
    `</span></a>`
  );
}

/** Danh sach item -> 1 khoi HTML grid card (rong -> caller tu bo hoan toan, khong goi ham nay). */
export function renderCardGrid(items: readonly CardItem[]): string {
  return `<div class="block-card-grid">${items.map(renderOneCard).join("")}</div>`;
}
