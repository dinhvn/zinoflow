import { normalizeVietnamese } from "../../../shared/text/vietnamese";

/**
 * So khop LONG 2 ten diem den (dichoithoi-cluster-poi-discovery-plan.md, quyet dinh
 * 27/07/2026: nguong long, luon de nguoi dung tu xem lai — tha bao nham "co the trung"
 * con hon bo sot trung that). Khop khi:
 * - Bang nhau tuyet doi SAU chuan hoa (bo dau/lowercase).
 * - 1 chuoi chua chuoi kia (vd "Mui Ne" vs "Bai Mui Ne").
 * - Ty le token chung (Jaccard theo tu) >= 0.5.
 *
 * ignoreTokens (bug phat hien 04/08/2026, cum Bảo Lộc): loai cac tu thuoc TEN
 * CUM ra khoi 2 chuoi truoc khi so sanh phan "chua chuoi"/Jaccard — hau het POI
 * trong 1 cum deu co ten chua ten cum ("... Đèo Bảo Lộc", "... Bảo Lộc") nen neu
 * khong loai, 2 diem HOAN TOAN KHAC NHAU (vd "Tượng Đức Mẹ Đèo Bảo Lộc" va "Đồi
 * Dổi Bảo Lộc") de dang bi khop nham chi vi cung chua cum tu ten cum. Neu 1 ben
 * SAU KHI BI LOAI TU (that su co tu bi cat, khac voi khong bi dung toi) CHI CON
 * DUNG 1 TU (vd "Đèo Bảo Lộc" -> chi con "đèo") thi tu con lai qua chung chung
 * (danh tu chung: đèo/núi/hồ/đồi/chùa...) de ket luan trung — bo qua, KHONG dung
 * lam can cu khop. Dieu kien "that su bi cat" (khac do dai truoc/sau strip) giup
 * KHONG anh huong cac ten viet tat 1-tu hop le khong lien quan ten cum (vd "Thác
 * Damb'ri" van khop voi "Damb'ri" nhu cu vi khong tu nao trong 2 ten nay trung
 * ten cum).
 */
export function isLikelySameDestinationName(
  a: string,
  b: string,
  ignoreTokens?: ReadonlySet<string>,
): boolean {
  const na = normalizeVietnamese(a);
  const nb = normalizeVietnamese(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const rawTokensA = na.split(" ").filter(Boolean);
  const rawTokensB = nb.split(" ").filter(Boolean);
  const strip = (tokens: string[]): string[] =>
    ignoreTokens && ignoreTokens.size > 0 ? tokens.filter((t) => !ignoreTokens.has(t)) : tokens;
  const stokensA = strip(rawTokensA);
  const stokensB = strip(rawTokensB);
  if (stokensA.length === 0 || stokensB.length === 0) return false;
  const wasStrippedToOneGenericToken = (raw: string[], stripped: string[]): boolean =>
    stripped.length < raw.length && stripped.length === 1;
  if (
    wasStrippedToOneGenericToken(rawTokensA, stokensA) ||
    wasStrippedToOneGenericToken(rawTokensB, stokensB)
  ) {
    return false;
  }

  const sa = stokensA.join(" ");
  const sb = stokensB.join(" ");
  if (sa.includes(sb) || sb.includes(sa)) return true;

  const tokensA = new Set(stokensA);
  const tokensB = new Set(stokensB);
  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union >= 0.5;
}
