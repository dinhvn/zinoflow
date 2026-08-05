import type { RunGeocodeBatchRequest } from "@zinoflow/contracts";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

/**
 * Dung chung cho RunGeocodeBatchUseCase (dem so diem khop de hien truoc khi
 * chay) va ProcessGeocodeBatchUseCase (worker, vong lap that) — tranh 2 noi
 * tinh khac nhau ra so khac nhau (dichoithoi-destination-geocode-audit-plan.md).
 */
export function matchesGeocodeFilter(
  d: DestinationMirrorEntity,
  f: Pick<RunGeocodeBatchRequest, "kind" | "parentSlug" | "provinceCode" | "missingCoords">,
): boolean {
  if (f.kind && d.kind !== f.kind) return false;
  if (f.parentSlug && d.parentSlug !== f.parentSlug) return false;
  if (f.provinceCode && d.provinceCode !== f.provinceCode) return false;
  if (f.missingCoords && !(d.lat === null || d.lng === null)) return false;
  return true;
}
