import { slugifyVietnamese } from "../text/vietnamese";

/**
 * So khop 1 dong import voi ban ghi da co — dung chung cho Hotel/Tour/Product
 * (product-spec §5.1, CHOT 07/2026): UPSERT theo khoa tu nhien `sourceUrl`;
 * khoa phu "slug + ten chuan hoa + tinh" cho truong hop trung ten/tinh nhung
 * sourceUrl khac (import lai sau khi da nhap tay truoc do) — KHONG tu dong
 * ghi de, tra ve needsConfirm de man dry-run hien "cho xac nhan gop".
 */
export interface ImportMatchCandidate {
  readonly id: string;
  readonly sourceUrl: string;
  readonly name: string;
  readonly provinceCode: string | null;
}

export type ImportRowAction =
  | { readonly type: "create" }
  | { readonly type: "update"; readonly matchedId: string }
  | { readonly type: "needsConfirm"; readonly matchedId: string; readonly reason: string };

export function matchImportRow(
  existing: readonly ImportMatchCandidate[],
  row: { readonly sourceUrl: string; readonly name: string; readonly provinceCode: string | null },
): ImportRowAction {
  const bySourceUrl = existing.find((e) => e.sourceUrl === row.sourceUrl);
  if (bySourceUrl) return { type: "update", matchedId: bySourceUrl.id };

  // Khoa phu can CA HAI co tinh ro rang — thieu tinh (null) khong du chac chan
  // de goi y gop, tranh 2 ban ghi khac nhau trung ten nhung deu chua co tinh
  // bi coi la trung nhau (vd 2 khach san cung ten "Khach San Hoa Sen").
  const byFallback = row.provinceCode
    ? existing.find(
        (e) => e.provinceCode === row.provinceCode && slugifyVietnamese(e.name) === slugifyVietnamese(row.name),
      )
    : undefined;
  if (byFallback) {
    return {
      type: "needsConfirm",
      matchedId: byFallback.id,
      reason: `Trùng tên + tỉnh với bản ghi đã có (sourceUrl khác) — xác nhận gộp "${row.sourceUrl}" vào bản ghi cũ?`,
    };
  }

  return { type: "create" };
}
