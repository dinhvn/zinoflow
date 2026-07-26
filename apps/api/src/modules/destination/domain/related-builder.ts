/**
 * Builder khoi "diem den lien quan" (RelatedJson) — destination-relations-plan
 * §1.3, Giai doan C2. 2 bac CUNG (quyet dinh nguoi/cay, dung truoc scoring):
 * con truc tiep -> related curated. Sau do CHAM DIEM toan bo ung vien con lai
 * theo cong thuc §1.3 (SUA 26/07/2026: yeu to CHI PHOI phu thuoc CUNG CUM hay
 * khong — cung cum thi Tag chi phoi (Type + khoang cach la tiebreaker phu);
 * khac cum thi Type chi phoi (khoang cach cum-cum la tang thu 2, Tag la
 * tiebreaker phu cuoi cung), xem scoreCandidate), xep hang giam dan, dien cho
 * toi khi du RELATED_MAX_COUNT muc HOAC het ung vien co tin hieu lien quan
 * that su (khong ep du so luong bang cach nhoi ung vien chi co priorityScore
 * — moi luon > 0). Pure TS + unit tests.
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
  /** Diem so tu scoreCandidate() (0 cho child/curated — khong qua cham diem) —
   * CHI co khi buildRelatedItems() vua tinh (preview live trong CMS, xem
   * RecomputeRelatedService.previewFor). RecomputeRelatedService.run() tu loc
   * bo truoc khi ghi RelatedJson cong khai — doc lai qua fetchRelatedJson (site
   * da publish) se KHONG co field nay (undefined), vi vay optional. */
  score?: number;
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
 * Diem TIERED (yeu to CHI PHOI) theo SO LUONG khop tuyet doi giua 2 tap slug:
 * khop TOAN BO tap cua self > khop >=2 > khop 1 > khong khop (0). Khoang cach
 * GIUA cac bac (1000) LON HON TONG moi thanh phan phu khac cong lai
 * (proximityTier 200 + distance 100 + typeOverlap/tagOverlap phu 50 + priority
 * 20 + tier 10 = 380) — dam bao thu tu theo SO KHOP LUON duoc giu nguyen,
 * khong bao gio bi cac yeu to phu vuot qua. Dung chung cho ca Tag va Type,
 * ai la yeu to chi phoi tuy vao sameCluster (xem scoreCandidate).
 */
function tieredOverlapScore(selfSlugs: readonly string[], candidateSlugs: readonly string[]): number {
  if (selfSlugs.length === 0) return 0;
  const selfSet = new Set(selfSlugs);
  const matched = candidateSlugs.filter((s) => selfSet.has(s)).length;
  if (matched === 0) return 0;
  if (matched === selfSlugs.length) return 3000; // khop TOAN BO tap cua self
  if (matched >= 2) return 2000;
  return 1000; // matched === 1
}

/**
 * Diem PHU (tiebreaker) theo TI LE giao nhau giua 2 tap — tran 50, cong voi
 * proximityTier(200)+distance(100)+priority(20)+tier(10) = 380, VAN nho hon
 * 1 bac cua tieredOverlapScore (1000) nen khong bao gio dao nguoc thu tu.
 */
function minorOverlapScore(selfSlugs: readonly string[], candidateSlugs: readonly string[]): number {
  if (selfSlugs.length === 0) return 0;
  const selfSet = new Set(selfSlugs);
  const overlap = candidateSlugs.filter((s) => selfSet.has(s)).length;
  return (50 * overlap) / selfSlugs.length;
}

function hasTagOverlap(self: RelatedCandidate, candidate: RelatedCandidate): boolean {
  if (self.tags.length === 0) return false;
  const selfTags = new Set(self.tags);
  return candidate.tags.some((t) => selfTags.has(t));
}

function hasTypeOverlap(self: RelatedCandidate, candidate: RelatedCandidate): boolean {
  if (self.types.length === 0) return false;
  const selfTypes = new Set(self.types);
  return candidate.types.some((t) => selfTypes.has(t));
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

/** True neu candidate CUNG CUM truc tiep voi self (parentSlug khop) — KHONG
 * tinh cung tinh khac cum (dung rieng de quyet dinh yeu to chi phoi ben duoi,
 * khac voi proximityTierScore dung cho ca cum LAN tinh). */
function isSameCluster(self: RelatedCandidate, candidate: RelatedCandidate): boolean {
  return Boolean(candidate.parentSlug && candidate.parentSlug === self.parentSlug);
}

/** He so nhan them cho diem khoang cach khi KHAC cum VA khong GAN (>= nguong
 * NEAR_CROSS_CLUSTER_METERS) — nguoi dung muon "cang gan cang uu tien" la 1
 * tang RO RANG ngay ca khi Type van chi phoi. x3 (toi da ~300, xem
 * distanceScore) — van nho hon 1 bac Type (1000) nen KHONG dao nguoc thu tu
 * theo Type, nhung du lon de LUON thang minorOverlapScore (Tag, toi da 50) +
 * priority/tier cong lai (~30-40).
 */
const CROSS_CLUSTER_DISTANCE_WEIGHT = 3;

/** Nguong "GAN" khi KHAC cum (phan hoi nguoi dung 26/07/2026 lan 2) — duoi
 * nguong nay, KHOANG CACH la yeu to CHI PHOI (khong phai Type); tu nguong
 * nay tro len, Type moi la yeu to chi phoi nhu quyet dinh truoc do. */
const NEAR_CROSS_CLUSTER_METERS = 50_000;

/** Diem GOC cho vung GAN — PHAI lon hon TRAN tuyet doi cua nhanh XA (Type
 * tiered 3000 + Tag minor 50 + proximityTier 100 + distance*3 (~6 luc gan
 * nguong 50km) + priority 20 + tier 10 ≈ 3186), dam bao GAN LUON thang XA
 * bat ke Type/Tag khop toi da the nao ben nhanh xa. */
const NEAR_DISTANCE_BASE = 3500;
/** Bien do phan biet trong NOI BO vung GAN (cang gan 0km cang cong them, toi
 * da +500 luc 0km, giam dan ve 0 luc gan cham nguong 50km). */
const NEAR_DISTANCE_RANGE = 500;

/**
 * Diem cho khoang cach GAN (< NEAR_CROSS_CLUSTER_METERS, khac cum) — LIEN TUC
 * (khong chia bac roi rac nhu tieredOverlapScore) vi ban than khoang cach da
 * la thang do lien tuc tu nhien: NEAR_DISTANCE_BASE (toi thieu trong vung
 * GAN, van > tran nhanh XA) cong them toi da NEAR_DISTANCE_RANGE khi o sat
 * 0km, giam tuyen tinh ve 0 khi tien den nguong 50km.
 */
function nearDistanceScore(meters: number): number {
  const clamped = Math.max(0, Math.min(meters, NEAR_CROSS_CLUSTER_METERS));
  return NEAR_DISTANCE_BASE + (1 - clamped / NEAR_CROSS_CLUSTER_METERS) * NEAR_DISTANCE_RANGE;
}

/**
 * Cong thuc cham diem day du (relations-plan §1.3, SUA 26/07/2026 lan 2 —
 * phan hoi nguoi dung: "trong cum Tag uu tien nhat; ngoai cum, duoi 50km thi
 * KHOANG CACH uu tien nhat, tu 50km tro len thi Type uu tien nhat"):
 *
 * - CUNG CUM truc tiep (parentSlug khop): Tag la yeu to chi phoi (tiered),
 *   Type chi la tiebreaker phu, khoang cach dung trong so thuong (toi da 100).
 * - KHAC CUM, LA POI (kind=poi) VA GAN (< 50km, biet chac khoang cach that):
 *   KHOANG CACH la yeu to chi phoi (qua nearDistanceScore, cang gan cang cao
 *   — luon thang moi ung vien "xa"), Type/Tag deu chi la tiebreaker phu.
 * - KHAC CUM VA (XA >= 50km HOAC khong phai POI — vd Cum/Tinh): Type la yeu
 *   to chi phoi (tiered), khoang cach van la tang thu 2 (trong so x3), Tag
 *   la tiebreaker phu cuoi cung.
 *
 * Ly do 2 nhanh khac-cum: duoi 50km thuc te van du gan de ghep chung 1 buoi/
 * 1 ngay trong lich trinh — do la tin hieu quan trong nhat; tu 50km tro len,
 * khong con chac chan gan du de ghep chung nua, luc do "cung loai hinh"
 * (Type) la tin hieu dang tin hon Tag de goi y. Luat "gan chi phoi" CHI danh
 * cho POI — node Cum/Tinh la node hanh chinh, luon "gan" bat ke co lien quan
 * gi khong, ap dung chung se chiem het top danh sach bang cac node khong
 * phai diem tham quan (phat hien qua verify live 26/07/2026, sua ngay).
 *
 * `poiDistances` mac dinh rong (fallback Haversine toan bo) — cac test/caller
 * cu khong truyen tham so nay van chay dung nhu truoc.
 */
export function scoreCandidate(
  self: RelatedCandidate,
  candidate: RelatedCandidate,
  clusterDistances: ReadonlyMap<string, number>,
  poiDistances: ReadonlyMap<string, number> = new Map(),
): number {
  const sameCluster = isSameCluster(self, candidate);
  const distanceMeters = rankingDistanceMeters(self, candidate, clusterDistances, poiDistances);
  const baseDistanceScore = distanceScore(distanceMeters);
  // Luat "gan chi phoi" CHI danh cho ung vien la diem tham quan that (kind=poi)
  // — node Cum/Tinh (kind=cluster/province) la node hanh chinh, luon "gan"
  // bat ke co lien quan gi khong nen se chiem het top danh sach neu ap dung
  // chung (phat hien qua verify live 26/07/2026, sua ngay). Cum/Tinh van dung
  // nhanh Type-chi-phoi nhu binh thuong.
  const isNearCrossCluster =
    !sameCluster &&
    candidate.kind === "poi" &&
    distanceMeters !== null &&
    distanceMeters < NEAR_CROSS_CLUSTER_METERS;

  let dominantScore: number;
  let weightedDistanceScore: number;
  if (sameCluster) {
    dominantScore =
      tieredOverlapScore(self.tags, candidate.tags) + minorOverlapScore(self.types, candidate.types);
    weightedDistanceScore = baseDistanceScore;
  } else if (isNearCrossCluster) {
    dominantScore =
      nearDistanceScore(distanceMeters!) +
      minorOverlapScore(self.types, candidate.types) +
      minorOverlapScore(self.tags, candidate.tags);
    weightedDistanceScore = baseDistanceScore; // da chi phoi qua tier, khong can nhan them
  } else {
    dominantScore =
      tieredOverlapScore(self.types, candidate.types) + minorOverlapScore(self.tags, candidate.tags);
    weightedDistanceScore = baseDistanceScore * CROSS_CLUSTER_DISTANCE_WEIGHT;
  }

  return (
    dominantScore +
    proximityTierScore(self, candidate) +
    weightedDistanceScore +
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
 * SUA 26/07/2026 — nhan phai theo dung yeu to CHI PHOI thuc su cua scoreCandidate:
 * CUNG CUM kiem tra hasTagMatch TRUOC (Tag chi phoi trong cum); KHAC CUM kiem
 * tra hasTypeMatch TRUOC (Type chi phoi ngoai cum) — neu van giu 1 thu tu co
 * dinh se nham lan (nhan noi sai yeu to thuc su khien ung vien duoc chon/xep
 * hang cao). "same-type-cluster" chi con la fallback khi CUNG CUM nhung
 * KHONG co tag khop nao ca.
 */
function classifyCriterion(self: RelatedCandidate, candidate: RelatedCandidate): RelatedCriterion {
  const hasTypeMatch = hasTypeOverlap(self, candidate);
  const hasTagMatch = hasTagOverlap(self, candidate);
  const sameCluster = isSameCluster(self, candidate);
  const sameProvince = Boolean(candidate.provinceCode && candidate.provinceCode === self.provinceCode);
  if (hasTagMatch && hasTypeMatch) return "same-type-tag";
  if (sameCluster) {
    if (hasTagMatch) return "same-tag";
    if (hasTypeMatch) return "same-type-cluster";
  } else {
    if (hasTypeMatch) return "same-type";
    if (hasTagMatch) return "same-tag";
  }
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
  /** Cho phep ung vien CHUA publish (mac dinh false — giu nguyen hanh vi cu,
   * dung cho RelatedJson that ghi SQL Server). true CHI danh cho preview
   * live trong CMS khi self chua publish (RecomputeRelatedService.previewFor) —
   * nguoi dung soan xong toan bo 1 cum roi publish cung luc muon xem truoc
   * quan he giua cac diem draft voi nhau (phan hoi nguoi dung 26/07/2026). */
  includeDrafts?: boolean;
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
  const includeDrafts = input.includeDrafts ?? false;
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

  const pick = (
    slug: string,
    badge: string | null,
    criterion: RelatedCriterion,
    score: number = 0,
  ): void => {
    if (picked.length >= RELATED_MAX_COUNT || pickedSlugs.has(slug)) return;
    const c = bySlug.get(slug);
    if (!c || (!includeDrafts && c.siteStatus !== 1)) return;
    pickedSlugs.add(slug);
    picked.push({ slug: c.slug, name: c.name, thumbnail: c.thumbnail, badge, criterion, score });
  };

  // Bac 1: con truc tiep (tinh/cum) — toi da 4, khong qua scoring
  const children = all.filter(
    (c) => c.parentSlug === self.slug && (includeDrafts || c.siteStatus === 1),
  );
  for (const child of children.slice(0, MAX_CHILDREN_IN_RELATED)) pick(child.slug, null, "child");

  // Bac 2: related curated (quyet dinh bien tap, override thuat toan)
  for (const slug of curatedRelatedSlugs) pick(slug, null, "curated");

  // Bac 3: cham diem CHI ung vien co tin hieu lien quan that, xep hang giam dan
  if (picked.length < RELATED_MAX_COUNT) {
    const scored = all
      .filter((c) => (includeDrafts || c.siteStatus === 1) && !pickedSlugs.has(c.slug))
      .filter((c) => hasGenuineRelevance(self, c, clusterDistances, poiDistances))
      .map((c) => ({ candidate: c, score: scoreCandidate(self, c, clusterDistances, poiDistances) }))
      .sort((a, b) => b.score - a.score);

    for (const { candidate, score } of scored) {
      pick(candidate.slug, badgeFor(candidate), classifyCriterion(self, candidate), score);
    }
  }

  return picked;
}
