import {
  buildRelatedItems,
  computeNearby,
  haversineMeters,
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

describe("computeNearby (spec dichoithoi §12.3 pha 1)", () => {
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

describe("buildRelatedItems (redesign §9 — quy tac tron)", () => {
  it("prioritizes children (max 4) then curated then nearby then siblings", () => {
    const self = candidate({ slug: "self", parentSlug: "cha" });
    const all = [
      self,
      candidate({ slug: "con-1", parentSlug: "self" }),
      candidate({ slug: "con-2", parentSlug: "self" }),
      candidate({ slug: "con-3", parentSlug: "self" }),
      candidate({ slug: "con-4", parentSlug: "self" }),
      candidate({ slug: "con-5", parentSlug: "self" }), // qua max 4 con
      candidate({ slug: "curated" }),
      candidate({ slug: "nearby" }),
      candidate({ slug: "anh-em", parentSlug: "cha" }),
    ];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: ["curated"],
      nearby: [{ slug: "nearby", distanceMeters: 2_500 }],
    });
    expect(items.map((i) => i.slug)).toEqual([
      "con-1", "con-2", "con-3", "con-4", // max 4 con
      "curated",
      "nearby",
      "anh-em",
      "con-5", // lap day tu "cung tinh"
    ]);
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
      nearby: [],
    });
    expect(items).toHaveLength(8);
    expect(items[0]!.slug).toBe("p-0");
    expect(items.map((i) => i.slug)).not.toContain("an");
    expect(items.map((i) => i.slug)).not.toContain("self");
  });

  it("renders distance badge in Vietnamese format", () => {
    const self = candidate({ slug: "self" });
    const all = [self, candidate({ slug: "gan" }), candidate({ slug: "rat-gan" })];
    const items = buildRelatedItems({
      self,
      all,
      curatedRelatedSlugs: [],
      nearby: [
        { slug: "rat-gan", distanceMeters: 800 },
        { slug: "gan", distanceMeters: 2_500 },
      ],
    });
    expect(items.find((i) => i.slug === "rat-gan")!.badge).toBe("cách 800 m");
    expect(items.find((i) => i.slug === "gan")!.badge).toBe("cách 2,5 km");
  });
});
