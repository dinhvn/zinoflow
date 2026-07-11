/**
 * Builder khoi "diem den lien quan" (RelatedJson) — spec dichoithoi §12.3,
 * quy tac tron da duyet o redesign doc §9: con -> related curated -> nearby ->
 * anh em cung cha -> cung tinh, dedupe, cat du 8 muc. Pure TS + unit tests.
 */

export const RELATED_ITEM_COUNT = 8;
export const NEARBY_RADIUS_METERS = 30_000;
export const NEARBY_TOP_COUNT = 10;
const MAX_CHILDREN_IN_RELATED = 4;

/** Diem den ung vien (tu mirror) — chi can truong phuc vu chon + render */
export interface RelatedCandidate {
  slug: string;
  name: string;
  thumbnail: string | null;
  kind: "province" | "cluster" | "poi";
  parentSlug: string | null;
  provinceCode: string | null;
  lat: number | null;
  lng: number | null;
  /** Status ben site — chi diem published (1) duoc vao khoi lien quan */
  siteStatus: number | null;
  /** Nam trong khu "noi bat" (v2.Destination.IsFeatured) — Phase 28.2, lop 1 Diem tham quan */
  isFeatured: boolean;
  /** Thu tu hien thi thu cong (v2.Destination.Order) — Phase 28.2 */
  order: number;
  /** Khoang cach toi trung tam cum/tinh cha, don vi MET (v2.Destination.DistanceFromCenter) — Phase 28.2 */
  distanceFromCenter: number | null;
}

/** 1 muc trong RelatedJson — website render truc tiep, khong query them */
export interface RelatedItem {
  slug: string;
  name: string;
  thumbnail: string | null;
  /** "cách 2,5 km" voi nearby; nguon khac de trong (website tu render loai) */
  badge: string | null;
}

/** Khoang cach haversine (met) giua 2 toa do */
export function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const EARTH_RADIUS_M = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)));
}

export interface NearbyEntry {
  slug: string;
  distanceMeters: number;
}

/**
 * Tinh danh sach nearby cho 1 diem (spec §12.3 pha 1): khoang cach toi moi diem
 * published co toa do, top 10 trong ban kinh 30km, gan nhat truoc.
 */
export function computeNearby(
  self: RelatedCandidate,
  all: readonly RelatedCandidate[],
): NearbyEntry[] {
  if (self.lat === null || self.lng === null) return [];
  return all
    .filter(
      (c) =>
        c.slug !== self.slug &&
        c.siteStatus === 1 &&
        c.lat !== null &&
        c.lng !== null,
    )
    .map((c) => ({
      slug: c.slug,
      distanceMeters: haversineMeters(self.lat!, self.lng!, c.lat!, c.lng!),
    }))
    .filter((e) => e.distanceMeters <= NEARBY_RADIUS_METERS)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, NEARBY_TOP_COUNT);
}

function formatDistanceBadge(meters: number): string {
  if (meters < 1000) return `cách ${meters} m`;
  const km = (meters / 1000).toFixed(1).replace(".", ",").replace(/,0$/, "");
  return `cách ${km} km`;
}

export interface RelatedInput {
  self: RelatedCandidate;
  all: readonly RelatedCandidate[];
  /** Quan he related curated (type 2), da sort theo weight giam dan */
  curatedRelatedSlugs: readonly string[];
  /** Nearby da tinh (pha 1) — gan nhat truoc */
  nearby: readonly NearbyEntry[];
}

/**
 * Build RelatedJson cho 1 diem (spec §12.3 pha 2). Thu tu uu tien:
 * 1. Con truc tiep (toi da 4) -> 2. related curated -> 3. nearby ->
 * 4. anh em cung cha -> 5. cung tinh. Dedupe + loai chinh no + chi published,
 * cat du 8 muc. (Quy tac "cung loai chinh" thay bang "cung tinh" — mirror
 * chua co type map; ghi nhan o spec §12.3.)
 */
export function buildRelatedItems(input: RelatedInput): RelatedItem[] {
  const { self, all, curatedRelatedSlugs, nearby } = input;
  const bySlug = new Map(all.map((c) => [c.slug, c]));
  const distanceBySlug = new Map(nearby.map((e) => [e.slug, e.distanceMeters]));

  const picked: RelatedItem[] = [];
  const pickedSlugs = new Set<string>([self.slug]);

  const pick = (slug: string, badge: string | null): void => {
    if (picked.length >= RELATED_ITEM_COUNT || pickedSlugs.has(slug)) return;
    const c = bySlug.get(slug);
    if (!c || c.siteStatus !== 1) return;
    pickedSlugs.add(slug);
    picked.push({ slug: c.slug, name: c.name, thumbnail: c.thumbnail, badge });
  };

  // 1. Con truc tiep (tinh/cum) — toi da 4
  const children = all.filter((c) => c.parentSlug === self.slug && c.siteStatus === 1);
  for (const child of children.slice(0, MAX_CHILDREN_IN_RELATED)) pick(child.slug, null);

  // 2. Related curated (theo weight)
  for (const slug of curatedRelatedSlugs) pick(slug, null);

  // 3. Nearby — badge khoang cach
  for (const entry of nearby) {
    pick(entry.slug, formatDistanceBadge(entry.distanceMeters));
  }

  // 4. Anh em cung cha
  if (self.parentSlug) {
    for (const c of all) {
      if (c.parentSlug === self.parentSlug && c.slug !== self.slug) pick(c.slug, null);
    }
  }

  // 5. Cung tinh (uu tien diem co toa do gan neu biet khoang cach)
  if (self.provinceCode) {
    const sameProvince = all
      .filter((c) => c.provinceCode === self.provinceCode && c.slug !== self.slug)
      .sort(
        (a, b) =>
          (distanceBySlug.get(a.slug) ?? Number.MAX_SAFE_INTEGER) -
          (distanceBySlug.get(b.slug) ?? Number.MAX_SAFE_INTEGER),
      );
    for (const c of sameProvince) pick(c.slug, null);
  }

  return picked;
}
