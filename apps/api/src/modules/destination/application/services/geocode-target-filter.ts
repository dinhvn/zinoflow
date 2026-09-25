import type { RunGeocodeBatchRequest } from "@zinoflow/contracts";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Dung chung cho RunGeocodeBatchUseCase (dem so diem khop de hien truoc khi
 * chay) va ProcessGeocodeBatchUseCase (worker, vong lap that) — tranh 2 noi
 * tinh khac nhau ra so khac nhau (dichoithoi-destination-geocode-audit-plan.md).
 */
export function matchesGeocodeFilter(
  d: DestinationMirrorEntity,
  f: Pick<RunGeocodeBatchRequest, "slugs" | "kind" | "parentSlug" | "provinceCode" | "missingCoords">,
): boolean {
  // slugs = tick tay tu checkbox trang danh sach — khi co, CHI dung danh sach nay,
  // bo qua moi filter khac (nguoi dung da chon dung diem ho muon, khong can loc them).
  if (f.slugs && f.slugs.length > 0) return f.slugs.includes(d.slug);
  if (f.kind && d.kind !== f.kind) return false;
  if (f.parentSlug && d.parentSlug !== f.parentSlug) return false;
  if (f.provinceCode && d.provinceCode !== f.provinceCode) return false;
  if (f.missingCoords && !(d.lat === null || d.lng === null)) return false;
  return true;
}

/**
 * Loai cac diem DA TUNG co dong staging geocode (bat ke pending/not-found/
 * accepted/rejected) khoi danh sach target — tranh quet lai vo ich cai da
 * biet ket qua (yeu cau nguoi dung 06/08/2026: "tôi thấy có đánh dấu để
 * không chạy lại không"). CHI ap dung khi chay theo BO LOC (khong co
 * `slugs` tick tay ro rang) — neu nguoi dung DA TICK CHECKBOX 1 diem cu the,
 * coi la y muon chay lai deu duoc, khong loai.
 */
export function excludeAlreadyAttempted<T extends { slug: string }>(
  targets: T[],
  attemptedSlugs: ReadonlySet<string>,
  hasExplicitSlugs: boolean,
): T[] {
  if (hasExplicitSlugs) return targets;
  return targets.filter((t) => !attemptedSlugs.has(t.slug));
}
