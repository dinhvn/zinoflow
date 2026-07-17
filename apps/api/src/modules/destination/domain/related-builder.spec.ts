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

describe("scoreCandidate (relations-plan §1.3)", () => {
  const noClusterDistances = new Map<string, number>();

  it("cung loai hinh khac cum PHAI thang khac loai hinh cung cum", () => {
    const self = candidate({ slug: "self", parentSlug: "cum-a", types: ["bien-dao"] });
    const sameTypeOtherCluster = candidate({
      slug: "cung-loai-khac-cum",
      parentSlug: "cum-b",
      types: ["bien-dao"],
    });
    const otherTypeSameCluster = candidate({
      slug: "khac-loai-cung-cum",
      parentSlug: "cum-a",
      types: ["di-tich-lich-su"],
    });

    const scoreSameType = scoreCandidate(self, sameTypeOtherCluster, noClusterDistances);
    const scoreSameCluster = scoreCandidate(self, otherTypeSameCluster, noClusterDistances);

    expect(scoreSameType).toBeGreaterThan(scoreSameCluster);
  });

  it("Priority KHONG duoc dao thu tu cung-loai-hinh, ke ca Priority=1 vs Priority=5", () => {
    const self = candidate({ slug: "self", types: ["bien-dao"] });
    const sameTypeLowPriority = candidate({
      slug: "cung-loai-uu-tien-thap",
      types: ["bien-dao"],
      priority: 5,
    });
    const otherTypeHighPriority = candidate({
      slug: "khac-loai-uu-tien-cao",
      types: ["di-tich-lich-su"],
      priority: 1,
    });

    const scoreSameType = scoreCandidate(self, sameTypeLowPriority, noClusterDistances);
    const scoreOtherType = scoreCandidate(self, otherTypeHighPriority, noClusterDistances);

    expect(scoreSameType).toBeGreaterThan(scoreOtherType);
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

  it("dedupes, skips unpublished and caps at 8", () => {
    const self = candidate({ slug: "self" });
    const all = [
      self,
      candidate({ slug: "an", siteStatus: 0 }),
      ...Array.from({ length: 12 }, (_, i) => candidate({ slug: `p-${i}` })),
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: ["p-0", "p-0", "an", "self"],
      clusterDistances: noClusterDistances,
    });
    expect(items).toHaveLength(8);
    expect(items[0]!.slug).toBe("p-0");
    expect(items.map((i) => i.slug)).not.toContain("an");
    expect(items.map((i) => i.slug)).not.toContain("self");
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

  it("gan dung criterion cho tung nguon (Giai doan D1)", () => {
    const self = candidate({
      slug: "self",
      parentSlug: "cha",
      provinceCode: "22",
      types: ["bien-dao"],
      distanceFromCenter: 1_000,
    });
    const all = [
      self,
      candidate({ slug: "con", parentSlug: "self" }),
      candidate({ slug: "curated" }),
      candidate({ slug: "cung-loai-cung-cum", parentSlug: "cha", types: ["bien-dao"] }),
      candidate({
        slug: "cung-loai-khac-cum",
        parentSlug: "cum-khac",
        provinceCode: "99",
        types: ["bien-dao"],
      }),
      candidate({ slug: "cung-tinh-khac-loai", provinceCode: "22" }),
      // Khac cum/tinh, khac loai, chi con lai diem gan (mo hinh 2 tang co du lieu)
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
      clusterDistances: new Map([[clusterDistanceKey("cha", "cum-xa"), 5_000]]),
    });
    const criterionBySlug = new Map(items.map((i) => [i.slug, i.criterion]));
    expect(criterionBySlug.get("con")).toBe("child");
    expect(criterionBySlug.get("curated")).toBe("curated");
    expect(criterionBySlug.get("cung-loai-cung-cum")).toBe("same-type-cluster");
    expect(criterionBySlug.get("cung-loai-khac-cum")).toBe("same-type");
    expect(criterionBySlug.get("cung-tinh-khac-loai")).toBe("same-province");
    expect(criterionBySlug.get("chi-gan")).toBe("nearby");
  });
});
