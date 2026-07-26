import type { SiteDestinationRow } from "../../domain/destination-mirror";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";
import type { TaxonomyTypeSuggestCandidate } from "../../domain/taxonomy-type-suggest-prompt";

/**
 * Gop ung vien ra soat Type tu 2 nguon: SQL Server (diem da publish) + Postgres
 * mirror (diem CHUA publish, siteId=null) — twin cua tag-suggest-candidates.ts,
 * cung ly do (phan hoi nguoi dung 26/07/2026, cum "Đạ Tẻh").
 */
export function buildTaxonomyTypeSuggestCandidates(
  allDestinations: readonly SiteDestinationRow[],
  mirrors: readonly DestinationMirrorEntity[],
  clusterSlug: string,
  acceptedSlugs: ReadonlySet<string>,
): TaxonomyTypeSuggestCandidate[] {
  const published = allDestinations
    .filter((d) => d.kind === "poi" && d.parentSlug === clusterSlug && !acceptedSlugs.has(d.slug))
    .map((d) => ({ slug: d.slug, name: d.name }));
  const drafts = mirrors
    .filter(
      (m) => m.kind === "poi" && m.siteId === null && m.parentSlug === clusterSlug && !acceptedSlugs.has(m.slug),
    )
    .map((m) => ({ slug: m.slug, name: m.name }));
  return [...published, ...drafts];
}
