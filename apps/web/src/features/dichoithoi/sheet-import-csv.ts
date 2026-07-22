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

/** "Tỉnh Lâm Đồng" / "lam-dong" / "Lâm Đồng" -> "lam dong" de so khop khong phan biet dau/hoa-thuong/gach ngang. */
function normalizeProvinceKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/^(tinh|thanh pho|tp\.?)\s+/, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Nguoi dung hay go ten tinh ("Lâm Đồng", "lam-dong") thay vi ma so 2 chu so
 * vao cot provinceCode trong Sheet. Neu gia tri da dung ma 2 chu so thi giu
 * nguyen; neu khop ten/ten rut gon 1 tinh trong taxonomy thi tra ve ma tuong
 * ung; khong khop thi tra nguyen gia tri goc de server bao loi ro rang.
 */
export function resolveProvinceCode(
  raw: string | undefined,
  provinces: ReadonlyArray<{ provinceCode: string; name: string; shortName: string }>,
): string | undefined {
  const v = emptyToUndef(raw);
  if (v === undefined) return undefined;
  if (/^\d{1,2}$/.test(v)) return v.padStart(2, "0");
  const key = normalizeProvinceKey(v);
  const found = provinces.find(
    (p) => normalizeProvinceKey(p.name) === key || normalizeProvinceKey(p.shortName) === key,
  );
  return found?.provinceCode ?? v;
}

/**
 * Doi 1 dong "items.{idx}.{field}: message" tho tu ZodValidationPipe (path
 * dang so, khong biet slug nao) -> "Dong N (slug) - field: message" de nguoi
 * dung biet ngay dong nao trong Sheet can sua, khong phai tra DB thu cong.
 */
export function formatValidationDetail(
  detail: string,
  rows: ReadonlyArray<{ slug?: string }>,
): string {
  const m = /^items\.(\d+)\.(\S+):\s*(.*)$/.exec(detail);
  if (!m) return detail;
  const idx = Number(m[1]);
  const field = m[2];
  const message = m[3];
  const slug = rows[idx]?.slug;
  return `Dòng ${idx + 1}${slug ? ` (${slug})` : ""} - ${field}: ${message}`;
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
