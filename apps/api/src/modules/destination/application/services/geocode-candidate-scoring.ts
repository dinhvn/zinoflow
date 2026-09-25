import type { GeocodeCandidateStagedItem } from "@zinoflow/contracts";
import { normalizeVietnamese } from "../../../shared/text/vietnamese";
import { haversineMeters } from "../../domain/related-builder";
import type { PlaceTextSearchResult } from "../ports/place-geocoding-provider.port";

/** Ban kinh location bias quanh toa do cum cha — cum du lich thuong trai vai chuc km */
export const LOCATION_BIAS_RADIUS_METERS = 20_000;

/** So ung vien toi da luu vao 1 dong staging (danh cho ca 1a lan 1b) */
export const MAX_STAGED_CANDIDATES = 5;

/**
 * 0-1, 60% do giong ten (Jaccard token, chuan hoa tieng Viet) + 40% khoang
 * cach toi cum cha (cang gan cum cha cang cao, xa hon ban kinh bias = 0).
 * distanceMeters=null (khong co cum cha co toa do) → coi nhu trung tinh 0.5.
 */
export function scoreCandidate(
  targetName: string,
  candidateName: string,
  distanceMeters: number | null,
  radiusMeters: number,
): number {
  const nameScore = nameSimilarity(targetName, candidateName);
  const distanceScore = distanceMeters === null ? 0.5 : Math.max(0, 1 - distanceMeters / radiusMeters);
  return Math.round((0.6 * nameScore + 0.4 * distanceScore) * 100) / 100;
}

function nameSimilarity(a: string, b: string): number {
  const na = normalizeVietnamese(a);
  const nb = normalizeVietnamese(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const tokensA = new Set(na.split(" ").filter(Boolean));
  const tokensB = new Set(nb.split(" ").filter(Boolean));
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Chuyen ket qua tho tu PlaceGeocodingProvider thanh danh sach ung vien
 * staging (xep hang theo confidence, cat toi da MAX_STAGED_CANDIDATES) —
 * dung chung cho ca 1a (GetGeocodeSuggestionsUseCase) lan 1b
 * (ProcessGeocodeBatchUseCase) de tranh 2 noi tinh diem khac nhau.
 */
export function buildStagedCandidates(
  targetName: string,
  results: PlaceTextSearchResult[],
  locationBias?: { lat: number; lng: number },
): GeocodeCandidateStagedItem[] {
  return results
    .map((r) => {
      const distanceToParentMetersAtDiscovery = locationBias
        ? haversineMeters(locationBias.lat, locationBias.lng, r.lat, r.lng)
        : null;
      return {
        placeId: r.placeId,
        displayNameAtDiscovery: r.displayName,
        confidenceScore: scoreCandidate(
          targetName,
          r.displayName,
          distanceToParentMetersAtDiscovery,
          LOCATION_BIAS_RADIUS_METERS,
        ),
        distanceToParentMetersAtDiscovery,
        latAtDiscovery: r.lat,
        lngAtDiscovery: r.lng,
        googleMapsUrlAtDiscovery: r.googleMapsUri,
        formattedAddressAtDiscovery: r.formattedAddress,
        nationalPhoneNumberAtDiscovery: r.nationalPhoneNumber,
        websiteUriAtDiscovery: r.websiteUri,
        businessStatusAtDiscovery: r.businessStatus,
        ratingAtDiscovery: r.rating,
        userRatingCountAtDiscovery: r.userRatingCount,
        webResultUrlsAtDiscovery: r.webResultUrls,
      };
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, MAX_STAGED_CANDIDATES);
}
