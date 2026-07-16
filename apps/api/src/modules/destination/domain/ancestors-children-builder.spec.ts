import { buildAncestors, buildChildren } from "./ancestors-children-builder";
import type { RelatedCandidate } from "./related-builder";

function candidate(overrides: Partial<RelatedCandidate> & { slug: string }): RelatedCandidate {
  return {
    slug: overrides.slug,
    name: overrides.name ?? overrides.slug,
    thumbnail: overrides.thumbnail ?? null,
    kind: overrides.kind ?? "poi",
    parentSlug: overrides.parentSlug ?? null,
    provinceCode: overrides.provinceCode ?? null,
    lat: overrides.lat ?? null,
    lng: overrides.lng ?? null,
    siteStatus: overrides.siteStatus ?? 1,
    priority: overrides.priority ?? 3,
    order: overrides.order ?? 0,
    distanceFromCenter: overrides.distanceFromCenter ?? null,
  };
}

describe("buildAncestors", () => {
  const lamDong = candidate({ slug: "lam-dong", name: "Lâm Đồng", kind: "province" });
  const daLat = candidate({
    slug: "da-lat",
    name: "Đà Lạt",
    kind: "cluster",
    parentSlug: "lam-dong",
  });
  const thungLung = candidate({
    slug: "thung-lung-tinh-yeu",
    name: "Thung Lũng Tình Yêu",
    kind: "poi",
    parentSlug: "da-lat",
  });
  const all = [lamDong, daLat, thungLung];

  it("tra ve mang tu goc den cha truc tiep, khong gom chinh no", () => {
    const result = buildAncestors(thungLung, all);
    expect(result).toEqual([
      { slug: "lam-dong", name: "Lâm Đồng", kind: "province" },
      { slug: "da-lat", name: "Đà Lạt", kind: "cluster" },
    ]);
  });

  it("tra ve mang rong khi khong co cha", () => {
    expect(buildAncestors(lamDong, all)).toEqual([]);
  });

  it("dung ngay khi gap chu trinh, khong lap vo han", () => {
    const a = candidate({ slug: "a", parentSlug: "b" });
    const b = candidate({ slug: "b", parentSlug: "a" });
    const result = buildAncestors(a, [a, b]);
    expect(result.length).toBeLessThanOrEqual(2);
  });
});

describe("buildChildren", () => {
  const daLat = candidate({ slug: "da-lat", name: "Đà Lạt", kind: "cluster" });
  const thungLung = candidate({
    slug: "thung-lung-tinh-yeu",
    name: "Thung Lũng Tình Yêu",
    kind: "poi",
    parentSlug: "da-lat",
  });
  const hoXuanHuong = candidate({
    slug: "ho-xuan-huong",
    name: "Hồ Xuân Hương",
    kind: "poi",
    parentSlug: "da-lat",
  });
  const unpublished = candidate({
    slug: "chua-publish",
    name: "Ẩn",
    kind: "poi",
    parentSlug: "da-lat",
    siteStatus: 2,
  });

  it("tra ve toan bo con truc tiep DA PUBLISH, sap xep theo ten", () => {
    const result = buildChildren(daLat, [daLat, thungLung, hoXuanHuong, unpublished]);
    expect(result.map((r) => r.slug)).toEqual(["ho-xuan-huong", "thung-lung-tinh-yeu"]);
  });

  it("mang theo priority/order/distanceFromCenter cho lop 1/2 trang Flagship (Phase 28.2)", () => {
    const featured = candidate({
      slug: "hstc",
      name: "Hồ Xuân Hương",
      parentSlug: "da-lat",
      priority: 1,
      order: 1,
      distanceFromCenter: 500,
    });
    const result = buildChildren(daLat, [daLat, featured]);
    expect(result[0]).toMatchObject({ priority: 1, order: 1, distanceFromCenter: 500 });
  });

  it("khong gioi han so luong (khac RelatedJson cat 8)", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      candidate({ slug: `con-${i}`, name: `Con ${i}`, parentSlug: "da-lat" }),
    );
    const result = buildChildren(daLat, [daLat, ...many]);
    expect(result).toHaveLength(20);
  });
});
