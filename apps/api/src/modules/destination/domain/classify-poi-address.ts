/**
 * Phan loai dia chi tu do (AI Gemini tra ve khi tim diem con trong cum,
 * find-cluster-poi-candidates.usecase.ts) la dang CU (truoc sap nhap don vi
 * hanh chinh) hay dang MOI — quyet dinh ghi vao cot AddressOld hay AddressNew
 * (nguoi dung phat hien 07/2026: da so AI tra ve dia chi CU, truoc day code
 * luon ghi thang vao AddressNew bat ke dung/sai).
 *
 * Dung chung nguon du lieu admin_ward_mappings/admin_wards (destination-spec
 * §13) da co san cho trang /dichoithoi/dia-chi — khong bia du lieu: neu
 * khong tim thay ten phuong/xa nao (cu lan moi) trong chuoi dia chi thi GIU
 * NGUYEN hanh vi cu (coi la dia chi moi, khong doan).
 */

export interface WardMappingRow {
  readonly oldWardName: string | null;
  readonly newWardName: string | null;
}

export interface PoiAddressClassification {
  readonly addressNew: string;
  readonly addressOld: string | null;
}

/** Ten phuong/xa trong dvhcvn mang tien to hanh chinh ("Xã Đại Lãnh") ma dia
 * chi tu do thuong bo qua ("Đại Lãnh, Khánh Hòa") — bo tien to de substring
 * match co co hoi trung. */
function stripWardPrefix(name: string): string {
  return name.replace(/^(Xã|Phường|Thị trấn|Đặc khu)\s+/i, "").trim();
}

/**
 * @param rawAddress dia chi AI tra ve cho 1 diem con.
 * @param newWardNames ten phuong/xa MOI (sau sap nhap) thuoc dung tinh cua cum.
 * @param wardMappings anh xa phuong/xa CU -> MOI thuoc dung tinh cua cum.
 */
export function classifyPoiAddress(
  rawAddress: string,
  newWardNames: readonly string[],
  wardMappings: readonly WardMappingRow[],
): PoiAddressClassification {
  const trimmed = rawAddress.trim();

  // Uu tien kiem tra "da la dia chi cu" truoc — 1 dia chi cu co the tinh co
  // chua 1 chuoi con trung ten phuong moi (hiem nhung khong loai tru), nen
  // chi coi la "da moi" khi KHONG khop duoc voi bat ky phuong cu nao.
  const oldMatches = new Map<string, string>(); // oldWardName found -> newWardName
  const matchIndex = new Map<string, number>();
  for (const row of wardMappings) {
    if (!row.oldWardName || !row.newWardName) continue;
    const bareOld = stripWardPrefix(row.oldWardName);
    if (bareOld.length < 3) continue; // tranh khop nham ten qua ngan
    const idx = trimmed.indexOf(bareOld);
    if (idx === -1) continue;
    oldMatches.set(row.oldWardName, row.newWardName);
    matchIndex.set(row.oldWardName, idx);
  }

  if (oldMatches.size > 0) {
    // Nhieu phuong cu cung khop (hiem) -> chon cai xuat hien SOM NHAT trong
    // chuoi (dia chi tieng Viet di tu cu the -> tong quat: "{dia danh},
    // {phuong/xa}, {tinh}"), cung heuristic da dung o dot migrate dia chi cu.
    const [bestOld, bestNew] = [...oldMatches.entries()].sort(
      (a, b) => matchIndex.get(a[0])! - matchIndex.get(b[0])!,
    )[0]!;
    const addressNew = trimmed.split(stripWardPrefix(bestOld)).join(bestNew);
    return { addressNew, addressOld: trimmed };
  }

  const looksNew = newWardNames.some((name) => {
    const bare = stripWardPrefix(name);
    return bare.length >= 3 && trimmed.includes(bare);
  });
  if (looksNew) {
    return { addressNew: trimmed, addressOld: null };
  }

  // Khong khop duoc ten phuong/xa nao (cu lan moi) trong chuoi — khong du can
  // cu de doan, giu hanh vi mac dinh cu (coi nhu dia chi moi) thay vi bia.
  return { addressNew: trimmed, addressOld: null };
}
