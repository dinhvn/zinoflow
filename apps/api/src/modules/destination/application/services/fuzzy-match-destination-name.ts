import { normalizeVietnamese } from "../../../shared/text/vietnamese";

/**
 * So khop LONG 2 ten diem den (dichoithoi-cluster-poi-discovery-plan.md, quyet dinh
 * 27/07/2026: nguong long, luon de nguoi dung tu xem lai — tha bao nham "co the trung"
 * con hon bo sot trung that). Khop khi:
 * - Bang nhau tuyet doi SAU chuan hoa (bo dau/lowercase).
 * - 1 chuoi chua chuoi kia (vd "Mui Ne" vs "Bai Mui Ne").
 * - Ty le token chung (Jaccard theo tu) >= 0.5.
 */
export function isLikelySameDestinationName(a: string, b: string): boolean {
  const na = normalizeVietnamese(a);
  const nb = normalizeVietnamese(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;

  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return intersection / union >= 0.5;
}
