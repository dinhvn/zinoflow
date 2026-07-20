import type { QualityCheck } from "@zinoflow/contracts";

/** Nguong similarity (thang 0-1 cua Postgres pg_trgm) tinh la "trung lap dang ngo". */
export const ORIGINALITY_SIMILARITY_THRESHOLD = 0.5;

export interface SimilarDestinationExcerpt {
  slug: string;
  /** Diem similarity 0-1 tra ve tu Postgres pg_trgm similarity(). */
  score: number;
}

export interface OriginalityGateInput {
  /** Ket qua tra ve tu IOriginalityCorpusRepository.findSimilar() — da tinh score san. */
  similarTo: readonly SimilarDestinationExcerpt[];
  threshold?: number;
}

/**
 * Gate "originality" (07/2026) — chong trung lap NOI BO giua cac bai AI cung
 * tinh (khac 4 gate cu: khong check du lieu/cau truc cua CHINH bai nay, ma so
 * voi bai KHAC da publish). LUON severity="warning" — khong chan Approve, vi
 * similarity cao co the la false-positive (cung tinh/loai dung chung tu vung
 * dia ly mot cach tu nhien) — nguoi duyet tu quyet dinh, khac 4 gate loi du
 * lieu/cau truc la block cung (quyet dinh nguoi dung 20/07/2026).
 */
export function evaluateDestinationOriginalityGate(input: OriginalityGateInput): QualityCheck {
  const threshold = input.threshold ?? ORIGINALITY_SIMILARITY_THRESHOLD;
  const suspicious = input.similarTo.filter((s) => s.score >= threshold);

  const details = suspicious.map(
    (s) => `Giống ${Math.round(s.score * 100)}% với bài đã publish "${s.slug}" — kiểm tra lại trước khi duyệt`,
  );

  return {
    gateName: "originality",
    passed: suspicious.length === 0,
    details,
    severity: "warning",
  };
}
