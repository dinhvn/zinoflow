import type { SiteTagAssignmentRow } from "../ports/dichoithoi-site-db.port";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { TagSuggestCandidate } from "../../domain/tag-suggest-prompt";

/**
 * Gop ung vien goi y tag tu 2 nguon: SQL Server (diem da publish, qua
 * fetchTagAssignments) + Postgres mirror (diem CHUA publish, siteId=null —
 * vd cum moi tao trong AI tool, tag dang o trang thai nhap qua mirror.tags).
 * Thieu ve mirror se khien "Xem truoc prompt"/"Goi y AI" bao 0 diem den cho
 * cum chi co diem chua publish (bug thuc te 26/07/2026, cum "Đạ Tẻh").
 */
export function buildTagSuggestCandidates(
  assignments: readonly SiteTagAssignmentRow[],
  mirrors: readonly DestinationMirrorEntity[],
  destinationSlugs: readonly string[] | undefined,
): Array<TagSuggestCandidate & { tagSlugs: string[] }> {
  const draftCandidates = mirrors
    .filter((m) => m.kind === "poi" && m.siteId === null)
    .map((m) => ({ destinationSlug: m.slug, destinationName: m.name, tagSlugs: m.tags }));

  const all = [...assignments, ...draftCandidates];
  const requestedSlugs = destinationSlugs?.length ? new Set(destinationSlugs) : null;
  return all.filter((c) =>
    requestedSlugs ? requestedSlugs.has(c.destinationSlug) : c.tagSlugs.length === 0,
  );
}
