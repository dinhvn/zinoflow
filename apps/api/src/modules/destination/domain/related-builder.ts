/**
 * Builder khoi "diem den lien quan" (RelatedJson) — destination-relations-plan
 * §1.3, Giai doan C2. 2 bac CUNG (quyet dinh nguoi/cay, dung truoc scoring):
 * con truc tiep -> related curated. Sau do CHAM DIEM toan bo ung vien con lai
 * theo cong thuc §1.3 (SUA 25/07/2026 lan 2: cung TAG la yeu to CHI PHOI —
 * tiered theo so tag khop tuyet doi, khop toan bo > khop >=2 > khop 1 > 0;
 * Type/khoang cach/uu tien/tier chi la tiebreaker phu, xem tagOverlapScore),
 * xep hang giam dan, dien cho toi khi du
 * RELATED_MAX_COUNT muc HOAC het ung vien co tin hieu lien quan that su (khong
 * ep du so luong bang cach nhoi ung vien chi co priorityScore — moi luon > 0).
 * Pure TS + unit tests.
 */

/** Tran tren so muc hien thi — KHONG phai muc tieu co dinh (so luong thuc te
 * bien thien tuy so ung vien co tin hieu lien quan that, xem hasGenuineRelevance). */
export const RELATED_MAX_COUNT = 12;
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
  /** Slug cac tag da gan (v2.DestinationTagMap, nhieu-nhieu) — mirror doc lap voi types.
   * Type = "la gi" (ban chat vat ly), Tag = "phu hop trai nghiem gi" (cat ngang doi tuong/
   * trai nghiem/boi canh/gia tri) — tin hieu THU 2 trong cham diem, khong thay the Type
   * (dichoithoi-taxonomy-chuan-hoa.md §0, relations-plan §1.3). */
  tags: string[];
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
  | "same-type-tag"
  | "same-type"
  | "same-tag"
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
 *
 * `includeDrafts` (mac dinh false, GIU NGUYEN hanh vi cu cho moi noi goi):
 * cho phep goi y ca diem CHUA publish — CHI dung cho tab "Quan he" trong CMS
 * (get-destination-detail.usecase.ts) de nguoi dung chu dong lien ket tay giua
 * cac diem draft cung cum truoc khi publish (phan hoi nguoi dung 26/07/2026).
 * KHONG bat o RecomputeNearbyDistancesUseCase/CreateDestinationJobUseCase —
 * 2 cho nay nuoi RelatedJson/auto-link cong khai tren site that, phai giu
 * published-only de khong goi y link toi trang chua ton tai (404).
 */
export function computeNearby(
  self: RelatedCandidate,
  all: readonly RelatedCandidate[],
  options: { includeDrafts?: boolean } = {},
): NearbyEntry[] {
  if (self.lat === null || self.lng === null) return [];
  return all
    .filter(
      (c) =>
        c.slug !== self.slug &&
        (options.includeDrafts || c.siteStatus === 1) &&
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

export function formatDistanceBadge(meters: number): string {
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
 * Diem "cung tag" (quyet dinh nguoi dung 25/07/2026, thay ban Type-chi-phoi
 * truoc do) — yeu to CHI PHOI CHINH cua cong thuc, TIERED theo SO LUONG tag
 * khop tuyet doi (khong phai ti le lien tuc nhu Type cu): khop TOAN BO tag
 * cua self > khop >=2 tag > khop 1 tag > khong khop (0). Khoang cach GIUA cac
 * bac (1000) LON HON TONG moi thanh phan phu khac cong lai (proximityTier 200
 * + distance 100 + typeOverlap 50 + priority 20 + tier 10 = 380) — dam bao
 * thu tu theo SO TAG KHOP LUON duoc giu nguyen, khong bao gio bi Type/khoang
 * cach/uu tien vuot qua (vd 1 diem chi khop 1/3 tag (1000) VAN thang 1 diem
 * khop 0 tag nhung trung ca Type lan cung cum (toi da ~380) — dung y do nguoi
 * dung: "khop tat ca uu tien nhat, khop 2 tag, khoang cach ngan, cung cum",
 * Type chi con la tiebreaker cuoi cung).
 */
function tagOverlapScore(self: RelatedCandidate, candidate: RelatedCandidate): number {
  if (self.tags.length === 0) return 0;
  const selfTags = new Set(self.tags);
  const matched = candidate.tags.filter((t) => selfTags.has(t)).length;
  if (matched === 0) return 0;
  if (matched === self.tags.length) return 3000; // khop TOAN BO tag cua self
  if (matched >= 2) return 2000;
  return 1000; // matched === 1
}

/**
 * Diem "cung loai hinh" — DA DEMOTE thanh tiebreaker PHU (25/07/2026, truoc
 * la yeu to chi phoi 1000 diem) vi Tag gio la tin hieu chinh. Tran 50 — cong
 * voi proximityTier(200)+distance(100)+priority(20)+tier(10) = 380, VAN nho
 * hon khoang cach 1 bac tag (1000) nen khong bao gio lam dao nguoc thu tu
 * theo so tag khop. So khop van theo TI LE giao nhau giua 2 tap.
 */
function typeOverlapScore(self: RelatedCandidate, candidate: RelatedCandidate): number {
  if (self.types.length === 0) return 0;
  const selfTypes = new Set(self.types);
  const overlap = candidate.types.filter((t) => selfTypes.has(t)).length;
  return (50 * overlap) / self.types.length;
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
    tagOverlapScore(self, candidate) +
    proximityTierScore(self, candidate) +
    distanceScore(rankingDistanceMeters(self, candidate, clusterDistances, poiDistances)) +
    priorityScore(candidate) +
    tierScore(candidate)
  );
}

/** Ngưỡng chặn CỨNG cho ứng viên KHÁC cụm/tỉnh (quyết định người dùng 25/07/2026) —
 * phát hiện thực tế: Bà Nà Hill (Đà Nẵng, cách 452km) lọt vào related của Dalat
 * Fairytale Land (Lâm Đồng) chỉ vì trùng Type+Tag, dù vô dụng cho người lên lịch
 * trình 1 chuyến đi. Type/Tag trùng bao nhiêu CŨNG KHÔNG được vượt rào khoảng cách
 * này khi khác khu vực địa lý — chỉ có ý nghĩa XẾP HẠNG trong 1 khu vực hợp lý. */
const MAX_CROSS_REGION_METERS = 100_000;

/**
 * True neu candidate DUOC PHEP xuat hien trong goi y (khong chi la co diem > 0):
 * - Cung cum/cung tinh (proximityTierScore > 0): luon hop le — Type/Tag quyet dinh
 *   THU TU trong nhom nay, khong quyet dinh co duoc vao hay khong.
 * - KHAC cum/tinh: BAT BUOC co du lieu khoang cach xep hang THAT va <=
 *   MAX_CROSS_REGION_METERS — Type/Tag trung nhieu CACH MAY cung khong duoc dung de
 *   vuot qua rao nay (tranh goi y dung ve noi dung nhung vo ly ve dia ly du lich).
 * priorityScore/tierScore KHONG duoc tinh la tin hieu rieng vi luon > 0 voi moi
 * candidate, se lam ung vien khong lien quan gi van lot vao danh sach chi de "du
 * so luong".
 */
function hasGenuineRelevance(
  self: RelatedCandidate,
  candidate: RelatedCandidate,
  clusterDistances: ReadonlyMap<string, number>,
  poiDistances: ReadonlyMap<string, number>,
): boolean {
  if (proximityTierScore(self, candidate) > 0) return true;
  const distance = rankingDistanceMeters(self, candidate, clusterDistances, poiDistances);
  return distance !== null && distance <= MAX_CROSS_REGION_METERS;
}

/**
 * Suy criterion cho 1 muc duoc chon qua CHAM DIEM (khong ap dung cho con/curated,
 * 2 nguon do da co criterion co dinh) — dua tren cac thanh phan diem co gia tri.
 *
 * SUA 25/07/2026 (lan 2) — dao thu tu uu tien theo cong thuc moi (Tag chi
 * phoi, xem tagOverlapScore): kiem tra hasTagMatch TRUOC hasTypeMatch (nguoc
 * lai ban truoc). Ly do: khi Tag da la yeu to quyet dinh diem so, nhan hien
 * thi cung phai theo dung logic do — neu van uu tien nhan "same-type*" truoc
 * se gay nham lan (nhan noi "cung loai hinh" trong khi thuc ra Tag moi la ly
 * do khien ung vien duoc chon/xep hang cao). "same-type-cluster" chi con la
 * fallback khi KHONG co tag khop nao ca.
 */
function classifyCriterion(self: RelatedCandidate, candidate: RelatedCandidate): RelatedCriterion {
  const hasTypeMatch = typeOverlapScore(self, candidate) > 0;
  const hasTagMatch = tagOverlapScore(self, candidate) > 0;
  const sameCluster = Boolean(candidate.parentSlug && candidate.parentSlug === self.parentSlug);
  const sameProvince = Boolean(candidate.provinceCode && candidate.provinceCode === self.provinceCode);
  if (hasTagMatch && hasTypeMatch) return "same-type-tag";
  if (hasTagMatch) return "same-tag";
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
 * 4) -> related curated. Con lai CHAM DIEM CHI cac ung vien co tin hieu lien
 * quan that (hasGenuineRelevance), xep hang giam dan, dien cho toi
 * RELATED_MAX_COUNT muc HOAC het ung vien dat chuan — so luong ket qua vi vay
 * bien thien theo diem den (it ung vien lien quan thi hien it hon
 * RELATED_MAX_COUNT, khong ep du). Dedupe + loai chinh no + chi published +
 * loai excludedSlugs (neu co) TRUOC moi buoc.
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
    if (picked.length >= RELATED_MAX_COUNT || pickedSlugs.has(slug)) return;
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

  // Bac 3: cham diem CHI ung vien co tin hieu lien quan that, xep hang giam dan
  if (picked.length < RELATED_MAX_COUNT) {
    const scored = all
      .filter((c) => c.siteStatus === 1 && !pickedSlugs.has(c.slug))
      .filter((c) => hasGenuineRelevance(self, c, clusterDistances, poiDistances))
      .map((c) => ({ candidate: c, score: scoreCandidate(self, c, clusterDistances, poiDistances) }))
      .sort((a, b) => b.score - a.score);

    for (const { candidate } of scored) {
      pick(candidate.slug, badgeFor(candidate), classifyCriterion(self, candidate));
    }
  }

  return picked;
}
