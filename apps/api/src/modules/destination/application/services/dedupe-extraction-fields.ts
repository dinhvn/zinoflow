import type { DestinationAiExtractionFieldItem } from "@zinoflow/contracts";

/**
 * Tach tu apps/api/scripts/upsert-destination-ai-extraction.ts (dung rieng cho
 * script CLI cua skill thu cong) thanh ham DUNG CHUNG — script CLI (source=skill)
 * VA use case backend GSG (source=gsg, §6 B2) cung goi ham nay, tranh viet 2 lan
 * lech nhau (dichoithoi-destination-ai-extraction-plan.md §6 A4).
 *
 * Quy tac: field cung KEY (rieng externalReviewUrl khop them theo `label` vi key
 * nay co the lap) co newValue GIONG HET lan truoc VA da duoc accepted -> giu
 * nguyen "accepted" (khong de xuat lai cai da duyet); gia tri MOI khac -> "pending".
 */

type Field = Omit<DestinationAiExtractionFieldItem, "currentValue">;

function labelOf(v: unknown): string | null {
  if (v && typeof v === "object" && "label" in v) {
    const label = (v as { label?: unknown }).label;
    return typeof label === "string" ? label.trim().toLowerCase() : null;
  }
  return null;
}

export function dedupeExtractionFields<F extends Field>(
  prevFields: readonly F[],
  newFields: readonly Omit<F, "status">[],
): F[] {
  const usedPrevIndexes = new Set<number>();

  return newFields.map((f) => {
    let prevIndex = -1;
    if (f.key === "externalReviewUrl") {
      const label = labelOf(f.newValue);
      prevIndex = prevFields.findIndex(
        (p, i) => p.key === f.key && !usedPrevIndexes.has(i) && labelOf(p.newValue) === label,
      );
    } else {
      prevIndex = prevFields.findIndex((p, i) => p.key === f.key && !usedPrevIndexes.has(i));
    }

    let status: DestinationAiExtractionFieldItem["status"] = "pending";
    if (prevIndex >= 0) {
      usedPrevIndexes.add(prevIndex);
      const prev = prevFields[prevIndex]!;
      const sameValue = JSON.stringify(prev.newValue) === JSON.stringify(f.newValue);
      if (prev.status === "accepted" && sameValue) status = "accepted";
    }
    return { ...f, status } as F;
  });
}
