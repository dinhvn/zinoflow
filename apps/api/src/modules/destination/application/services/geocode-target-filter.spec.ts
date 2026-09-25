import { matchesGeocodeFilter } from "./geocode-target-filter";
import type { DestinationMirrorEntity } from "../../infrastructure/entities/destination-mirror.entity";

function makeDestination(overrides: Partial<DestinationMirrorEntity>): DestinationMirrorEntity {
  return {
    slug: "test",
    kind: "poi",
    parentSlug: null,
    provinceCode: null,
    lat: null,
    lng: null,
    ...overrides,
  } as DestinationMirrorEntity;
}

describe("matchesGeocodeFilter", () => {
  it("matches everything when no filter fields are set", () => {
    expect(matchesGeocodeFilter(makeDestination({}), {})).toBe(true);
  });

  it("filters by parentSlug", () => {
    const inCluster = makeDestination({ parentSlug: "da-lat" });
    const outsideCluster = makeDestination({ parentSlug: "sapa" });
    expect(matchesGeocodeFilter(inCluster, { parentSlug: "da-lat" })).toBe(true);
    expect(matchesGeocodeFilter(outsideCluster, { parentSlug: "da-lat" })).toBe(false);
  });

  it("filters by kind", () => {
    expect(matchesGeocodeFilter(makeDestination({ kind: "cluster" }), { kind: "poi" })).toBe(false);
    expect(matchesGeocodeFilter(makeDestination({ kind: "poi" }), { kind: "poi" })).toBe(true);
  });

  it("missingCoords=true excludes destinations that already have both lat and lng", () => {
    const hasCoords = makeDestination({ lat: "10.5", lng: "106.5" });
    const noCoords = makeDestination({ lat: null, lng: null });
    expect(matchesGeocodeFilter(hasCoords, { missingCoords: true })).toBe(false);
    expect(matchesGeocodeFilter(noCoords, { missingCoords: true })).toBe(true);
  });

  it("slugs (checkbox tick tay) overrides mọi filter khác — chỉ khớp đúng danh sách", () => {
    const picked = makeDestination({ slug: "da-lat", kind: "cluster", parentSlug: "lam-dong" });
    const notPicked = makeDestination({ slug: "sapa", kind: "cluster", parentSlug: "lao-cai" });
    const filter = { slugs: ["da-lat"], kind: "poi" as const };
    expect(matchesGeocodeFilter(picked, filter)).toBe(true);
    expect(matchesGeocodeFilter(notPicked, filter)).toBe(false);
  });
});
