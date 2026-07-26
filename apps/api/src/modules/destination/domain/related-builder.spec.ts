import {
  buildRelatedItems,
  clusterDistanceKey,
  computeNearby,
  haversineMeters,
  scoreCandidate,
  type RelatedCandidate,
} from "./related-builder";

function candidate(partial: Partial<RelatedCandidate> & { slug: string }): RelatedCandidate {
  return {
    name: partial.slug,
    thumbnail: null,
    kind: "poi",
    parentSlug: null,
    provinceCode: "22",
    lat: null,
    lng: null,
    siteStatus: 1,
    priority: 3,
    order: 0,
    distanceFromCenter: null,
    types: [],
    tags: [],
    contentTier: null,
    ...partial,
  };
}

describe("haversineMeters", () => {
  it("computes a known distance (Hanoi -> Ha Long ~ 130km)", () => {
    const d = haversineMeters(21.0285, 105.8542, 20.9101, 107.1839);
    expect(d).toBeGreaterThan(125_000);
    expect(d).toBeLessThan(145_000);
  });
});

describe("computeNearby (panel goi y nearby khi curate tay)", () => {
  const self = candidate({ slug: "self", lat: 20.91, lng: 107.18 });

  it("returns closest-first within 30km, excluding self and unpublished", () => {
    const all = [
      self,
      candidate({ slug: "gan", lat: 20.92, lng: 107.19 }),
      candidate({ slug: "xa-hon", lat: 21.0, lng: 107.3 }),
      candidate({ slug: "qua-xa", lat: 22.5, lng: 109.0 }),
      candidate({ slug: "an", lat: 20.92, lng: 107.19, siteStatus: 2 }),
      candidate({ slug: "khong-toa-do" }),
    ];
    const nearby = computeNearby(self, all);
    expect(nearby.map((n) => n.slug)).toEqual(["gan", "xa-hon"]);
    expect(nearby[0]!.distanceMeters).toBeLessThan(nearby[1]!.distanceMeters);
  });

  it("returns empty when self has no coordinates", () => {
    expect(computeNearby(candidate({ slug: "self" }), [])).toEqual([]);
  });
});

describe("scoreCandidate (relations-plan §1.3, SUA 26/07/2026: yeu to chi phoi phu thuoc CUNG CUM hay khong)", () => {
  const noClusterDistances = new Map<string, number>();

  it("CUNG CUM: khop TAG (du chi 1/vai tag) PHAI thang chenh lech Type+khoang cach cong lai " +
    "(trong 1 cum, Tag la yeu to CHI PHOI, Type chi con la tiebreaker)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      types: ["bien-dao"],
      tags: ["phu-hop-gia-dinh", "lang-man-cap-doi", "check-in-song-ao"],
    });
    const khopMotTagKhacType = candidate({
      slug: "khop-1-tag",
      parentSlug: "cum-a", // cung cum voi self
      types: ["nui-cao-nguyen"], // khac type -> mat typeOverlap minor
      tags: ["check-in-song-ao"], // khop 1/3 tag cua self -> tier 1000
    });
    const khopKhongTagCungType = candidate({
      slug: "khop-0-tag",
      parentSlug: "cum-a", // cung cum voi self
      types: ["bien-dao"], // cung type -> +50 (minor trong cum)
      tags: [], // khong khop tag nao -> 0
    });

    const scoreTagWins = scoreCandidate(self, khopMotTagKhacType, noClusterDistances);
    const scoreTypeOnly = scoreCandidate(self, khopKhongTagCungType, noClusterDistances);

    // 1000 (khop 1/3 tag, tiered) > 50 (cung type, minor) + priority mac dinh
    expect(scoreTagWins).toBeGreaterThan(scoreTypeOnly);
  });

  it("CUNG CUM: khop TOAN BO tag PHAI thang khop 2 tag, khop 2 tag PHAI thang khop 1 tag", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      tags: ["phu-hop-gia-dinh", "lang-man-cap-doi", "check-in-song-ao"],
    });
    const khop3 = candidate({
      slug: "khop-3",
      parentSlug: "cum-a",
      tags: ["phu-hop-gia-dinh", "lang-man-cap-doi", "check-in-song-ao"],
    });
    const khop2 = candidate({
      slug: "khop-2",
      parentSlug: "cum-a",
      tags: ["phu-hop-gia-dinh", "lang-man-cap-doi"],
    });
    const khop1 = candidate({ slug: "khop-1", parentSlug: "cum-a", tags: ["phu-hop-gia-dinh"] });

    const score3 = scoreCandidate(self, khop3, noClusterDistances);
    const score2 = scoreCandidate(self, khop2, noClusterDistances);
    const score1 = scoreCandidate(self, khop1, noClusterDistances);

    expect(score3).toBeGreaterThan(score2);
    expect(score2).toBeGreaterThan(score1);
  });

  it("CUNG CUM: self co 3 tag, ung vien chi khop 1 tag VAN thang ung vien khop 0 tag du trung " +
    "ca Type lan flagship ('type sau tag' trong pham vi 1 cum)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      types: ["bien-dao"],
      tags: ["phu-hop-gia-dinh", "lang-man-cap-doi", "check-in-song-ao"],
      contentTier: "flagship",
    });
    const khop1TagKhacType = candidate({
      slug: "khop-1-tag-khac-type",
      parentSlug: "cum-a",
      types: ["nui-cao-nguyen"],
      tags: ["check-in-song-ao"],
    });
    const khop0TagCungTypeFlagship = candidate({
      slug: "khop-0-tag-cung-type-flagship",
      parentSlug: "cum-a",
      types: ["bien-dao"],
      tags: [],
      contentTier: "flagship", // + tierScore, van khong du
    });

    const scoreTag = scoreCandidate(self, khop1TagKhacType, noClusterDistances);
    const scoreTypeTier = scoreCandidate(self, khop0TagCungTypeFlagship, noClusterDistances);

    expect(scoreTag).toBeGreaterThan(scoreTypeTier);
  });

  it("CUNG CUM: Priority KHONG duoc dao thu tu cung-loai-hinh (Type la minor trong cum), " +
    "ke ca Priority=1 vs Priority=5", () => {
    const self = candidate({ slug: "self", parentSlug: "cum-a", types: ["bien-dao"] });
    const sameTypeLowPriority = candidate({
      slug: "cung-loai-uu-tien-thap",
      parentSlug: "cum-a",
      types: ["bien-dao"],
      priority: 5,
    });
    const otherTypeHighPriority = candidate({
      slug: "khac-loai-uu-tien-cao",
      parentSlug: "cum-a",
      types: ["di-tich-lich-su"],
      priority: 1,
    });

    const scoreSameType = scoreCandidate(self, sameTypeLowPriority, noClusterDistances);
    const scoreOtherType = scoreCandidate(self, otherTypeHighPriority, noClusterDistances);

    expect(scoreSameType).toBeGreaterThan(scoreOtherType);
  });

  it("NGOAI CUM: khop TYPE (du chi 1 loai) PHAI thang chenh lech Tag+priority cong lai " +
    "(ngoai cum, Type la yeu to CHI PHOI — phan hoi nguoi dung 26/07/2026, dao nguoc CUNG CUM)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      types: ["bien-dao"],
      tags: ["check-in-song-ao"],
    });
    const khopTypeKhacCum = candidate({
      slug: "khop-type-khac-cum",
      parentSlug: "cum-b", // khac cum voi self
      types: ["bien-dao"], // khop type cua self -> tier 3000
      tags: [], // khong khop tag -> 0
    });
    const khopTagKhacCum = candidate({
      slug: "khop-tag-khac-cum",
      parentSlug: "cum-c", // khac cum voi self
      types: ["nui-cao-nguyen"], // khac type -> 0
      tags: ["check-in-song-ao"], // khop tag cua self -> minor 50
    });

    const scoreType = scoreCandidate(self, khopTypeKhacCum, noClusterDistances);
    const scoreTag = scoreCandidate(self, khopTagKhacCum, noClusterDistances);

    expect(scoreType).toBeGreaterThan(scoreTag);
  });

  it("NGOAI CUM: 2 diem CUNG bac Type nhung o cum GAN hon PHAI thang o cum XA hon " +
    "(them yeu to khoang cach cum-cum, gan uu tien hon — phan hoi nguoi dung 26/07/2026)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      provinceCode: "01", // khac tinh voi ca 2 ung vien -> bat buoc dung mo hinh 2 tang qua clusterDistances
      distanceFromCenter: 1_000,
      types: ["bien-dao"],
    });
    const cumGan = candidate({
      slug: "cum-gan",
      parentSlug: "cum-b",
      provinceCode: "02",
      distanceFromCenter: 1_000,
      types: ["bien-dao"], // cung bac Type voi self (full match)
    });
    const cumXa = candidate({
      slug: "cum-xa",
      parentSlug: "cum-c",
      provinceCode: "03",
      distanceFromCenter: 1_000,
      types: ["bien-dao"], // cung bac Type voi self (full match)
    });
    const clusterDistances = new Map([
      [clusterDistanceKey("cum-a", "cum-b"), 10_000], // tong ~12km
      [clusterDistanceKey("cum-a", "cum-c"), 90_000], // tong ~92km
    ]);

    const scoreGan = scoreCandidate(self, cumGan, clusterDistances);
    const scoreXa = scoreCandidate(self, cumXa, clusterDistances);

    expect(scoreGan).toBeGreaterThan(scoreXa);
  });

  it("NGOAI CUM, GAN (< 50km): khoang cach thang du ung vien XA khop Type/Tag TOI DA " +
    "(phan hoi nguoi dung 26/07/2026 lan 2: duoi 50km khoang cach uu tien nhat)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      provinceCode: "01",
      distanceFromCenter: 1_000,
      types: ["bien-dao"],
      tags: ["check-in-song-ao"],
    });
    const ganKhacType = candidate({
      slug: "gan-khac-type",
      parentSlug: "cum-b",
      provinceCode: "02",
      distanceFromCenter: 1_000,
      types: ["nui-cao-nguyen"], // hoan toan khac type/tag voi self
      tags: [],
    });
    const xaCungTypeTag = candidate({
      slug: "xa-cung-type-tag",
      parentSlug: "cum-c",
      provinceCode: "03",
      distanceFromCenter: 1_000,
      types: ["bien-dao"], // khop toan bo type
      tags: ["check-in-song-ao"], // khop toan bo tag
      contentTier: "flagship",
      priority: 1,
    });
    const clusterDistances = new Map([
      [clusterDistanceKey("cum-a", "cum-b"), 20_000], // tong ~22km -> GAN (<50km)
      [clusterDistanceKey("cum-a", "cum-c"), 90_000], // tong ~92km -> XA (>=50km)
    ]);

    const scoreGan = scoreCandidate(self, ganKhacType, clusterDistances);
    const scoreXa = scoreCandidate(self, xaCungTypeTag, clusterDistances);

    // Gan (22km, khac type/tag hoan toan) VAN thang Xa (92km, khop ca Type
    // lan Tag toi da + flagship + priority cao nhat) — khoang cach chi phoi
    // tuyet doi trong vung < 50km, khong bi Type/Tag/priority/tier vuot qua.
    expect(scoreGan).toBeGreaterThan(scoreXa);
  });

  it("NGOAI CUM, dung nguong 50km: cang gan trong vung <50km cang diem cao (lien tuc)", () => {
    const self = candidate({ slug: "self", parentSlug: "cum-a", provinceCode: "01", distanceFromCenter: 0 });
    const rat10km = candidate({
      slug: "rat-gan",
      parentSlug: "cum-b",
      provinceCode: "02",
      distanceFromCenter: 0,
    });
    const gan45km = candidate({
      slug: "gan-sat-nguong",
      parentSlug: "cum-c",
      provinceCode: "03",
      distanceFromCenter: 0,
    });
    const clusterDistances = new Map([
      [clusterDistanceKey("cum-a", "cum-b"), 10_000],
      [clusterDistanceKey("cum-a", "cum-c"), 45_000],
    ]);

    const scoreRatGan = scoreCandidate(self, rat10km, clusterDistances);
    const scoreGanSatNguong = scoreCandidate(self, gan45km, clusterDistances);

    expect(scoreRatGan).toBeGreaterThan(scoreGanSatNguong);
  });

  it("luat 'GAN chi phoi' CHI ap dung cho POI — node Cum/Tinh gan van dung nhanh Type-chi-phoi " +
    "(phat hien qua verify live 26/07/2026: Cum/Tinh gan chiem het top danh sach neu khong loai)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      provinceCode: "01",
      distanceFromCenter: 1_000,
      types: ["bien-dao"],
    });
    const cumGanKhongCungType = candidate({
      slug: "cum-gan-khong-type",
      kind: "cluster", // node hanh chinh, khong phai POI
      parentSlug: "cum-b",
      provinceCode: "02",
      distanceFromCenter: 1_000,
      types: [], // khong co Type gi ca
    });
    const poiXaCungType = candidate({
      slug: "poi-xa-cung-type",
      kind: "poi",
      parentSlug: "cum-c",
      provinceCode: "03",
      distanceFromCenter: 1_000,
      types: ["bien-dao"], // khop toan bo type voi self
    });
    const clusterDistances = new Map([
      [clusterDistanceKey("cum-a", "cum-b"), 10_000], // ~12km -> GAN neu la POI
      [clusterDistanceKey("cum-a", "cum-c"), 90_000], // ~92km -> XA
    ]);

    const scoreCumGan = scoreCandidate(self, cumGanKhongCungType, clusterDistances);
    const scorePoiXa = scoreCandidate(self, poiXaCungType, clusterDistances);

    // Cum gan (12km) KHONG duoc huong luat "gan chi phoi" vi khong phai POI —
    // POI xa (92km) nhung khop Type toan bo van thang.
    expect(scorePoiXa).toBeGreaterThan(scoreCumGan);
  });

  it("cung cum/cung tinh dung haversine truc tiep tu toa do rieng", () => {
    const self = candidate({ slug: "self", parentSlug: "cum-a", lat: 21.0, lng: 105.8 });
    const sibling = candidate({ slug: "anh-em", parentSlug: "cum-a", lat: 21.001, lng: 105.801 });
    const score = scoreCandidate(self, sibling, noClusterDistances);
    // Cung cum (+200) + diem gan (toa do gan nhau, ~100m => gan max 100) — it nhat > 290
    expect(score).toBeGreaterThan(290);
  });

  it("khac cum dung mo hinh 2 tang (DistanceFromCenter + khoang cach cum) khi co du du lieu", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      provinceCode: "01",
      distanceFromCenter: 2_000,
      lat: null,
      lng: null,
    });
    const other = candidate({
      slug: "khac-cum",
      parentSlug: "cum-b",
      provinceCode: "02",
      distanceFromCenter: 3_000,
      lat: null,
      lng: null,
    });
    const clusterDistances = new Map([[clusterDistanceKey("cum-a", "cum-b"), 50_000]]);

    const score = scoreCandidate(self, other, clusterDistances);
    const priorityOnlyScore = (6 - other.priority) * 4; // priority mac dinh 3 -> 12
    // Khong cung cum/tinh (0) + diem gan uoc luong tu 55km (2+50+3, nho nhung > 0)
    // + priority — chi can lon hon phan priority la du chung to co cong diem gan.
    expect(score).toBeGreaterThan(priorityOnlyScore);
    expect(score).toBeLessThan(priorityOnlyScore + 10);
  });

  it("khac cum, khong co du lieu khoang cach cum -> khong co diem gan (khong bia)", () => {
    const self = candidate({ slug: "self", parentSlug: "cum-a", provinceCode: "01" });
    const other = candidate({ slug: "khac-cum-khac-tinh", parentSlug: "cum-b", provinceCode: "02" });
    const score = scoreCandidate(self, other, new Map());
    // Chi con lai priority mac dinh (12) — hoan toan khong co diem gan/cung cum/cung loai
    expect(score).toBe((6 - other.priority) * 4);
  });

  it("cung cum uu tien poiDistances (duong bo that) thay vi Haversine khi co du lieu", () => {
    // Toa do rat gan nhau (~100m Haversine) nhung duong bo that xa hon nhieu (deo/vong)
    const self = candidate({ slug: "self", parentSlug: "cum-a", lat: 21.0, lng: 105.8 });
    const sibling = candidate({ slug: "anh-em", parentSlug: "cum-a", lat: 21.001, lng: 105.801 });
    const poiDistances = new Map([[clusterDistanceKey("self", "anh-em"), 5_000]]);

    const scoreWithReal = scoreCandidate(self, sibling, noClusterDistances, poiDistances);
    const scoreHaversineOnly = scoreCandidate(self, sibling, noClusterDistances);

    // 5km thuc te cho diem gan THAP hon nhieu so voi ~100m Haversine uoc luong sai
    expect(scoreWithReal).toBeLessThan(scoreHaversineOnly);
  });

  it("NGOAI CUM: cung type (khong cung tag) PHAI thang cung tag (khong cung type) — Type chi phoi " +
    "ngoai cum (phan hoi nguoi dung 26/07/2026, dao nguoc ban truoc do Tag chi phoi moi noi)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      provinceCode: "22",
      types: ["bien-dao"],
      tags: ["check-in-song-ao"],
    });
    const sameTypeOnly = candidate({
      slug: "cung-type",
      parentSlug: "cum-b", // khac cum voi self
      provinceCode: "99",
      types: ["bien-dao"], // khop 1/1 type cua self -> full match, tier 3000
      tags: [],
    });
    const sameTagOtherType = candidate({
      slug: "cung-tag-khac-type",
      parentSlug: "cum-c", // khac cum voi self
      provinceCode: "99",
      types: ["nui-cao-nguyen"],
      tags: ["check-in-song-ao"],
    });

    const scoreSameType = scoreCandidate(self, sameTypeOnly, noClusterDistances);
    const scoreSameTag = scoreCandidate(self, sameTagOtherType, noClusterDistances);
    const fullTypeMatchScore = 3000 + (6 - sameTypeOnly.priority) * 4; // tier full-match + priority mac dinh

    expect(scoreSameType).toBe(fullTypeMatchScore);
    expect(scoreSameType).toBeGreaterThan(scoreSameTag); // Type gio la yeu to chi phoi ngoai cum
  });
});

describe("buildRelatedItems (relations-plan §1.3-§1.4, Giai doan C2)", () => {
  const noClusterDistances = new Map<string, number>();

  it("prioritizes children (max 4) then curated, sau do cham diem dien not the rest", () => {
    const self = candidate({ slug: "self", parentSlug: "cha" });
    const all = [
      self,
      candidate({ slug: "con-1", parentSlug: "self" }),
      candidate({ slug: "con-2", parentSlug: "self" }),
      candidate({ slug: "con-3", parentSlug: "self" }),
      candidate({ slug: "con-4", parentSlug: "self" }),
      candidate({ slug: "con-5", parentSlug: "self" }), // qua max 4 con
      candidate({ slug: "curated" }),
      candidate({ slug: "anh-em", parentSlug: "cha" }),
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: ["curated"],
      clusterDistances: noClusterDistances,
    });
    // 4 con dau + curated luon co mat; phan con lai (con-5, anh-em) dien theo
    // diem so (cung tinh +100 ca 2, hoa nhau -> thu tu con lai khong quan trong)
    expect(items.slice(0, 5).map((i) => i.slug)).toEqual([
      "con-1", "con-2", "con-3", "con-4", "curated",
    ]);
    expect(items.map((i) => i.slug)).toEqual(
      expect.arrayContaining(["con-5", "anh-em"]),
    );
    expect(items).toHaveLength(7);
  });

  it("dedupes, skips unpublished and caps at RELATED_MAX_COUNT (12) du con nhieu ung vien cung tinh", () => {
    const self = candidate({ slug: "self" });
    const all = [
      self,
      candidate({ slug: "an", siteStatus: 0 }),
      ...Array.from({ length: 20 }, (_, i) => candidate({ slug: `p-${i}` })), // cung provinceCode "22" -> co tin hieu lien quan
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: ["p-0", "p-0", "an", "self"],
      clusterDistances: noClusterDistances,
    });
    expect(items).toHaveLength(12);
    expect(items[0]!.slug).toBe("p-0");
    expect(items.map((i) => i.slug)).not.toContain("an");
    expect(items.map((i) => i.slug)).not.toContain("self");
  });

  it("KHONG ep du so luong bang ung vien vo can — chi con priorityScore (khong cung loai/cum/tinh/khoang cach) thi bi loai", () => {
    const self = candidate({ slug: "self", provinceCode: "22" });
    const all = [
      self,
      candidate({ slug: "cung-tinh", provinceCode: "22" }), // co tin hieu (proximityTierScore)
      candidate({ slug: "vo-can", provinceCode: "khac-tinh" }), // khong loai/cum/tinh/khoang cach chung -> chi priorityScore
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: [],
      clusterDistances: noClusterDistances,
    });
    expect(items.map((i) => i.slug)).toEqual(["cung-tinh"]);
  });

  it("KHAC cum/tinh: Type/Tag trung bao nhieu CUNG KHONG vuot duoc rao 100km — fix bug thuc te " +
    "'Ba Na Hill (452km) lot vao related cua Dalat Fairytale Land' (quyet dinh nguoi dung 25/07/2026)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cum-a",
      provinceCode: "01",
      distanceFromCenter: 2_000,
      types: ["khu-vui-choi-cong-vien"],
      tags: ["nghi-duong-chua-lanh"],
    });
    const gan55km = candidate({
      slug: "khac-vung-nhung-gan",
      parentSlug: "cum-b",
      provinceCode: "02",
      distanceFromCenter: 3_000,
      types: ["khu-vui-choi-cong-vien"],
      tags: ["nghi-duong-chua-lanh"],
    });
    const xa205km = candidate({
      slug: "khac-vung-va-xa",
      parentSlug: "cum-c",
      provinceCode: "03",
      distanceFromCenter: 3_000,
      types: ["khu-vui-choi-cong-vien"], // trung Type + Tag y het self — nhu ca Ba Na Hill
      tags: ["nghi-duong-chua-lanh"],
    });
    const khongCoDuLieuKhoangCach = candidate({
      slug: "khac-vung-khong-ro-khoang-cach",
      parentSlug: "cum-d",
      provinceCode: "04",
      types: ["khu-vui-choi-cong-vien"],
      tags: ["nghi-duong-chua-lanh"],
    });
    const clusterDistances = new Map([
      [clusterDistanceKey("cum-a", "cum-b"), 50_000], // tong 2+50+3=55km -> qua rao
      [clusterDistanceKey("cum-a", "cum-c"), 200_000], // tong 2+200+3=205km -> KHONG qua rao
      // "cum-d" khong co trong map -> khong biet khoang cach that -> KHONG qua rao
    ]);

    const items = buildRelatedItems({
      self,
      all: [self, gan55km, xa205km, khongCoDuLieuKhoangCach],
      curatedRelatedSlugs: [],
      clusterDistances,
    });

    expect(items.map((i) => i.slug)).toEqual(["khac-vung-nhung-gan"]);
    expect(items[0]!.criterion).toBe("same-type-tag"); // trung ca Type lan Tag, khac cum -> nhan gop
  });

  it("cham diem dua diem cung loai hinh len truoc diem chi cung tinh", () => {
    const self = candidate({ slug: "self", provinceCode: "22", types: ["bien-dao"] });
    const all = [
      self,
      candidate({ slug: "cung-tinh-khac-loai", provinceCode: "22", types: ["di-tich-lich-su"] }),
      candidate({ slug: "cung-loai-cung-tinh", provinceCode: "22", types: ["bien-dao"] }),
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: [],
      clusterDistances: noClusterDistances,
    });
    expect(items.map((i) => i.slug)).toEqual(["cung-loai-cung-tinh", "cung-tinh-khac-loai"]);
  });

  it("loai bo excludedSlugs khoi TOAN BO cac buoc (con, curated, cham diem) — relations-plan §5.7 muc 3", () => {
    const self = candidate({ slug: "self" });
    const all = [
      self,
      candidate({ slug: "con-bi-loai", parentSlug: "self" }),
      candidate({ slug: "curated-bi-loai" }),
      candidate({ slug: "diem-cao-bi-loai", types: ["bien-dao"] }),
      candidate({ slug: "diem-thuong" }),
    ];
    const items = buildRelatedItems({
      self: { ...self, types: ["bien-dao"] },
      all,
      curatedRelatedSlugs: ["curated-bi-loai"],
      clusterDistances: noClusterDistances,
      excludedSlugs: new Set(["con-bi-loai", "curated-bi-loai", "diem-cao-bi-loai"]),
    });
    expect(items.map((i) => i.slug)).toEqual(["diem-thuong"]);
  });

  it("renders distance badge (haversine that) khi ca 2 ben co toa do, du xep hang bang diem uoc luong", () => {
    const self = candidate({ slug: "self", lat: 21.0285, lng: 105.8542, provinceCode: "22" });
    const all = [
      self,
      candidate({ slug: "rat-gan", provinceCode: "22", lat: 21.0286, lng: 105.8543 }),
      candidate({ slug: "khong-toa-do", provinceCode: "22" }),
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: [],
      clusterDistances: noClusterDistances,
    });
    expect(items.find((i) => i.slug === "rat-gan")!.badge).toMatch(/^cách \d+ m$/);
    expect(items.find((i) => i.slug === "khong-toa-do")!.badge).toBeNull();
  });

  it("badge uu tien poiDistances (duong bo that) thay vi Haversine khi co du lieu", () => {
    const self = candidate({ slug: "self", lat: 21.0285, lng: 105.8542, provinceCode: "22" });
    const all = [self, candidate({ slug: "rat-gan", provinceCode: "22", lat: 21.0286, lng: 105.8543 })];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: [],
      clusterDistances: noClusterDistances,
      poiDistances: new Map([[clusterDistanceKey("self", "rat-gan"), 4_200]]),
    });
    expect(items.find((i) => i.slug === "rat-gan")!.badge).toBe("cách 4,2 km");
  });

  it("gan dung criterion cho tung nguon (Giai doan D1)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cha",
      provinceCode: "22",
      types: ["bien-dao"],
      tags: ["check-in-song-ao"],
      distanceFromCenter: 1_000,
    });
    const all = [
      self,
      candidate({ slug: "con", parentSlug: "self" }),
      candidate({ slug: "curated" }),
      candidate({ slug: "cung-loai-cung-cum", parentSlug: "cha", types: ["bien-dao"] }),
      // Khac cum/tinh — can du lieu khoang cach that <=100km de qua rao (hasGenuineRelevance)
      candidate({
        slug: "cung-loai-khac-cum",
        parentSlug: "cum-khac",
        provinceCode: "99",
        types: ["bien-dao"],
        distanceFromCenter: 2_000,
      }),
      candidate({ slug: "cung-tinh-khac-loai", provinceCode: "22" }),
      // Khac tinh/type/cum, chi cung tag — cung can du lieu khoang cach <=100km
      candidate({
        slug: "cung-tag-khac-tinh",
        parentSlug: "cum-tag",
        provinceCode: "khac-tinh",
        tags: ["check-in-song-ao"],
        distanceFromCenter: 2_000,
      }),
      // Khac cum/tinh, khac loai/tag, chi con lai diem gan (mo hinh 2 tang co du lieu)
      candidate({
        slug: "chi-gan",
        parentSlug: "cum-xa",
        provinceCode: "99",
        distanceFromCenter: 1_000,
      }),
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: ["curated"],
      clusterDistances: new Map([
        [clusterDistanceKey("cha", "cum-khac"), 50_000], // tong 1+50+2=53km -> qua rao
        [clusterDistanceKey("cha", "cum-tag"), 50_000], // tong 1+50+2=53km -> qua rao
        [clusterDistanceKey("cha", "cum-xa"), 5_000], // tong 1+5+1=7km -> qua rao
      ]),
    });
    const criterionBySlug = new Map(items.map((i) => [i.slug, i.criterion]));
    expect(criterionBySlug.get("con")).toBe("child");
    expect(criterionBySlug.get("curated")).toBe("curated");
    expect(criterionBySlug.get("cung-loai-cung-cum")).toBe("same-type-cluster");
    expect(criterionBySlug.get("cung-loai-khac-cum")).toBe("same-type");
    expect(criterionBySlug.get("cung-tinh-khac-loai")).toBe("same-province");
    expect(criterionBySlug.get("cung-tag-khac-tinh")).toBe("same-tag");
    expect(criterionBySlug.get("chi-gan")).toBe("nearby");
  });
});
