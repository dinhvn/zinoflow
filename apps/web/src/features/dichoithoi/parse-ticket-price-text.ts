/**
 * Tach van ban TicketPrice tu do (vd "600,000 d; trẻ em 500,000d") thanh cac
 * dong gia theo doi tuong goi y — LUON chi la goi y, khong bao gio tu luu (doc
 * dichoithoi-ticket-analysis.md §11.2). Nhan linh hoat: cum tu ngay truoc so
 * dau tien la nhan that; so KHONG nhan dau tien mac dinh "Người lớn"; so KHONG
 * nhan sau do dat ten trung lap "Giá vé {n}" — khong bao gio doan la "Trẻ em".
 */
export interface ParsedTicketPriceRow {
  audience: string;
  price: number;
  note: string | null;
}

const NUMBER_WITH_CURRENCY_RE = /([^,;.\n]{0,30}?)(\d[\d.,]*)\s*(?:đ|d)\b/gi;

export function parseTicketPriceText(text: string): ParsedTicketPriceRow[] {
  const rows: ParsedTicketPriceRow[] = [];
  let extraCount = 0;
  for (const match of text.matchAll(NUMBER_WITH_CURRENCY_RE)) {
    const labelRaw = match[1]?.trim().replace(/^[,;.\s]+/, "") ?? "";
    const price = Number(match[2]?.replace(/[.,](?=\d{3}\b)/g, "").replace(/[.,]/g, ""));
    if (!Number.isFinite(price) || price <= 0) continue;

    let audience: string;
    if (labelRaw) {
      audience = labelRaw;
    } else if (rows.length === 0) {
      audience = "Người lớn";
    } else {
      extraCount += 1;
      audience = `Giá vé ${extraCount + 1}`;
    }
    rows.push({ audience, price, note: null });
  }
  return rows;
}
