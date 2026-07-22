/**
 * Builder khoi "diem den lien quan" (RelatedJson) — destination-relations-plan
 * §1.3, Giai doan C2. 2 bac CUNG (quyet dinh nguoi/cay, dung truoc scoring):
 * con truc tiep -> related curated. Sau do CHAM DIEM toan bo ung vien con lai
 * theo cong thuc §1.3 (cung loai hinh la yeu to chi phoi, khoang cach/uu tien/
 * tier chi la trong so phu), xep hang giam dan, dien cho toi khi du 8 muc.
 * Pure TS + unit tests.
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
  /** Do uu tien tay 1-5, 1=cao nhat (v2.Destination.Priority) — thay IsFeatured cu
   * (relations-plan §1.1). Lop 1 "Diem tham quan" Flagship = priority <= 2 (Phase 28.2). */
  priority: number;
  /** Thu tu hien thi thu cong (v2.Destination.Order) — Phase 28.2 */
  order: number;
  /** Khoang cach toi trung tam cum/tinh cha, don vi MET (v2.Destination.DistanceFromCenter) — Phase 28.2 */
  distanceFromCenter: number | null;
  /** Slug cac loai hinh da gan (v2.DestinationTypeMap, nhieu-nhieu) — mirror Giai doan C1.
   * Rong voi kind != poi. Yeu to chi phoi thuat toan cham diem (relations-plan §1.3). */
  types: string[];
  /** Phan loai do sau noi dung — trong so phu trong cham diem (relations-plan §1.3) */
  contentTier: "flagship" | "standard" | null;
}

/**
 * Ly do 1 muc duoc chon (relations-plan mục 2, Giai doan D1) — suy tu NGUON
 * (child/curated) hoac tu 2 thanh phan diem cao nhat trong cong thuc cham
 * diem §1.3 (khong phai nhan theo nguon nhu waterfall cu). Website group
 * hien thi theo nhan nay thay vi 1 luoi phang 8 anh.
 */
export type RelatedCriterion =
  | "child"
  | "curated"
  | "same-type-cluster"
  | "same-type"
  | "nearby"
  | "same-province";

/** 1 muc trong RelatedJson — website render truc tiep, khong query them */
export interface RelatedItem {
  slug: string;
  name: string;
  thumbnail: string | null;
  /** "cách 2,5 km" khi biet toa do that ca 2 ben, nguoc lai de trong */
  badge: string | null;
  criterion: RelatedCriterion;
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
 * Tinh danh sach nearby cho 1 diem (panel "goi y nearby" khi bien tap tay
 * quan he curated — KHONG con dung de xay RelatedJson, xem buildRelatedItems):
 * khoang cach toi moi diem published co toa do, top 10 trong ban kinh 30km,
 * gan nhat truoc.
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

/** Khoa chuan hoa cho map khoang cach cum/tinh (khop dung CHECK cua bang
 * dichoithoi_cluster_distances: cluster_a_slug < cluster_b_slug). */
export function clusterDistanceKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Diem "cung loai hinh" (relations-plan §1.3) — so khop theo TI LE giao nhau
 * giua 2 tap (khong phai 1 gia tri don), trung cang nhieu loai cang thang.
 * self chua co loai nao (25/272 diem thuc te) -> luon 0, khong loi.
 */
function typeOverlapScore(self: RelatedCandidate, candidate: RelatedCandidate): number {
  if (self.types.length === 0) return 0;
  const selfTypes = new Set(self.types);
  const overlap = candidate.types.filter((t) => selfTypes.has(t)).length;
  return (1000 * overlap) / self.types.length;
}

function proximityTierScore(self: RelatedCandidate, candidate: RelatedCandidate): number {
  if (candidate.parentSlug && candidate.parentSlug === self.parentSlug) return 200;
  if (candidate.provinceCode && candidate.provinceCode === self.provinceCode) return 100;
  return 0;
}

/**
 * Khoang cach (met) dung de CHAM DIEM (mo hinh 2 tang, relations-plan §1.2) —
 * cung cum/cung tinh: uu tien tra `poiDistances` (duong bo that qua
 * OpenRouteService, dichoithoi-poi-distance-plan.md), fallback haversine truc
 * tiep tu toa do rieng neu chua tung tinh. Khac cum: uoc luong qua tam cum
 * (DistanceFromCenter + khoang_cach_cum + DistanceFromCenter) — theo bat dang
 * thuc tam giac LUON >= that, CHI dung de xep hang, KHONG hien thi (xem
 * badgeDistanceMeters ben duoi cho so hien thi that).
 */
function rankingDistanceMeters(
  self: RelatedCandidate,
  candidate: RelatedCandidate,
  clusterDistances: ReadonlyMap<string, number>,
  poiDistances: ReadonlyMap<string, number>,
): number | null {
  const sameCluster = Boolean(candidate.parentSlug && candidate.parentSlug === self.parentSlug);
  const sameProvince = Boolean(candidate.provinceCode && candidate.provinceCode === self.provinceCode);
  if (sameCluster || sameProvince) {
    const real = poiDistances.get(clusterDistanceKey(self.slug, candidate.slug));
    if (real !== undefined) return real;
    if (self.lat !== null && self.lng !== null && candidate.lat !== null && candidate.lng !== null) {
      return haversineMeters(self.lat, self.lng, candidate.lat, candidate.lng);
    }
    return null;
  }
  if (
    self.parentSlug &&
    candidate.parentSlug &&
    self.distanceFromCenter !== null &&
    candidate.distanceFromCenter !== null
  ) {
    const clusterDist = clusterDistances.get(clusterDistanceKey(self.parentSlug, candidate.parentSlug));
    if (clusterDist !== undefined) {
      return self.distanceFromCenter + clusterDist + candidate.distanceFromCenter;
    }
  }
  return null;
}

/** Diem gan — nghich dao khoang cach, toi da 100 (0km => 100, cang xa cang giam). */
function distanceScore(meters: number | null): number {
  if (meters === null) return 0;
  return 100 / (1 + meters / 1000);
}

/** Priority 1 (cao nhat) => +20, Priority 5 (thap nhat) => +4 — khong bao gio 0/am. */
function priorityScore(candidate: RelatedCandidate): number {
  return (6 - candidate.priority) * 4;
}

function tierScore(candidate: RelatedCandidate): number {
  return candidate.contentTier === "flagship" ? 10 : 0;
}

/**
 * Cong thuc cham diem day du (relations-plan §1.3) — export de test tung phan.
 * `poiDistances` mac dinh rong (fallback Haversine toan bo) — cac test/caller
 * cu khong truyen tham so nay van chay dung nhu truoc.
 */
export function scoreCandidate(
  self: RelatedCandidate,
  candidate: RelatedCandidate,
  clusterDistances: ReadonlyMap<string, number>,
  poiDistances: ReadonlyMap<string, number> = new Map(),
): number {
  return (
    typeOverlapScore(self, candidate) +
    proximityTierScore(self, candidate) +
    distanceScore(rankingDistanceMeters(self, candidate, clusterDistances, poiDistances)) +
    priorityScore(candidate) +
    tierScore(candidate)
  );
}

/**
 * Suy criterion cho 1 muc duoc chon qua CHAM DIEM (khong ap dung cho con/curated,
 * 2 nguon do da co criterion co dinh) — dua tren 2 thanh phan diem cao nhat
 * (relations-plan mục 2): co diem cung-loai-hinh la yeu to chinh (>0) thi uu
 * tien nhan "same-type*", cong them tier cum/tinh neu co; khong co diem loai
 * hinh thi xet cum/tinh/khoang cach.
 */
function classifyCriterion(self: RelatedCandidate, candidate: RelatedCandidate): RelatedCriterion {
  const hasTypeMatch = typeOverlapScore(self, candidate) > 0;
  const sameCluster = Boolean(candidate.parentSlug && candidate.parentSlug === self.parentSlug);
  const sameProvince = Boolean(candidate.provinceCode && candidate.provinceCode === self.provinceCode);
  if (hasTypeMatch && sameCluster) return "same-type-cluster";
  if (hasTypeMatch) return "same-type";
  if (sameCluster || sameProvince) return "same-province";
  return "nearby";
}

export interface RelatedInput {
  self: RelatedCandidate;
  all: readonly RelatedCandidate[];
  /** Quan he related curated (type 2), da sort theo weight giam dan */
  curatedRelatedSlugs: readonly string[];
  /** Khoang cach cum/tinh cap cao (dichoithoi_cluster_distances, Giai doan A2) —
   * khoa chuan hoa qua clusterDistanceKey(). */
  clusterDistances: ReadonlyMap<string, number>;
  /** Khoang cach duong bo that con->con cung cha/tinh (dichoithoi_poi_distances,
   * dichoithoi-poi-distance-plan.md) — uu tien truoc Haversine khi co, khoa
   * chuan hoa qua clusterDistanceKey(). Mac dinh rong = luon fallback Haversine. */
  poiDistances?: ReadonlyMap<string, number>;
  /** Slug bi ADMIN LOAI TRU tay khoi goi y cua self (relations-plan §5.7 muc 3,
   * Giai doan C3) — loc TRUOC ca 2 bac cung lan scoring, bat ke le ra diem cao
   * the nao. Mac dinh rong neu khong truyen (khong loai gi). */
  excludedSlugs?: ReadonlySet<string>;
}

/**
 * Build RelatedJson cho 1 diem (relations-plan §1.3-§1.4, Giai doan C2-C3). 2 bac
 * CUNG truoc (quyet dinh nguoi/cay, KHONG qua scoring): con truc tiep (toi da
 * 4) -> related curated. Con lai CHAM DIEM toan bo ung vien, xep hang giam
 * dan, dien cho toi 8 muc. Dedupe + loai chinh no + chi published + loai
 * excludedSlugs (neu co) TRUOC moi buoc.
 */
export function buildRelatedItems(input: RelatedInput): RelatedItem[] {
  const { self, curatedRelatedSlugs, clusterDistances } = input;
  const poiDistances = input.poiDistances ?? new Map<string, number>();
  const excludedSlugs = input.excludedSlugs ?? new Set<string>();
  const all = input.all.filter((c) => !excludedSlugs.has(c.slug));
  const bySlug = new Map(all.map((c) => [c.slug, c]));

  const picked: RelatedItem[] = [];
  const pickedSlugs = new Set<string>([self.slug]);

  const badgeFor = (candidate: RelatedCandidate): string | null => {
    const real = poiDistances.get(clusterDistanceKey(self.slug, candidate.slug));
    if (real !== undefined) return formatDistanceBadge(real);
    if (self.lat === null || self.lng === null || candidate.lat === null || candidate.lng === null) {
      return null;
    }
    return formatDistanceBadge(haversineMeters(self.lat, self.lng, candidate.lat, candidate.lng));
  };

  const pick = (slug: string, badge: string | null, criterion: RelatedCriterion): void => {
    if (picked.length >= RELATED_ITEM_COUNT || pickedSlugs.has(slug)) return;
    const c = bySlug.get(slug);
    if (!c || c.siteStatus !== 1) return;
    pickedSlugs.add(slug);
    picked.push({ slug: c.slug, name: c.name, thumbnail: c.thumbnail, badge, criterion });
  };

  // Bac 1: con truc tiep (tinh/cum) — toi da 4, khong qua scoring
  const children = all.filter((c) => c.parentSlug === self.slug && c.siteStatus === 1);
  for (const child of children.slice(0, MAX_CHILDREN_IN_RELATED)) pick(child.slug, null, "child");

  // Bac 2: related curated (quyet dinh bien tap, override thuat toan)
  for (const slug of curatedRelatedSlugs) pick(slug, null, "curated");

  // Bac 3: cham diem toan bo ung vien con lai, xep hang giam dan
  if (picked.length < RELATED_ITEM_COUNT) {
    const scored = all
      .filter((c) => c.siteStatus === 1 && !pickedSlugs.has(c.slug))
      .map((c) => ({ candidate: c, score: scoreCandidate(self, c, clusterDistances, poiDistances) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    for (const { candidate } of scored) {
      pick(candidate.slug, badgeFor(candidate), classifyCriterion(self, candidate));
    }
  }

  return picked;
}
