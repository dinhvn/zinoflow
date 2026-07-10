/**
 * Parse CSV/JSON dung chung cho cac trang nhap Sheet (destination/hotel/tour/
 * product) — tach ra tu app/dichoithoi/import/page.tsx de khong copy-paste
 * giua Hotel/Tour/Product (moi module chi khac rowFromObject + CSV_HEADERS).
 */

/** Parse CSV co ho tro o trong dau ngoac kep "" (xu ly dau phay/xuong dong ben trong). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  return rows;
}

export function emptyToUndef(s: string | undefined): string | undefined {
  return s && s.trim() !== "" ? s.trim() : undefined;
}

export function parseNumber(s: string | undefined): number | undefined {
  const v = emptyToUndef(s);
  return v === undefined ? undefined : Number(v);
}

/** Chuyen text (CSV hoac JSON) -> danh sach dong tho (Record<string,string>) — chua ep kieu tung module. */
export function parseRowsFromText(text: string): Array<Record<string, string>> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Chưa có dữ liệu");
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const json = JSON.parse(trimmed) as unknown;
    const arr = Array.isArray(json) ? json : [json];
    return arr.map((o) => o as Record<string, string>);
  }
  const rows = parseCsv(trimmed);
  if (rows.length < 2) throw new Error("CSV cần dòng tiêu đề + ít nhất 1 dòng dữ liệu");
  const headers = rows[0]!.map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const o: Record<string, string> = {};
    headers.forEach((h, i) => (o[h] = cells[i] ?? ""));
    return o;
  });
}
