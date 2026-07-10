import { computeCoverageScore, type CoverageInput } from "./coverage-score";

const FULL: CoverageInput = {
  kind: "poi",
  hasAddress: true,
  hasCoordinates: true,
  hasThumbnail: true,
  hasMainContent: true,
  hasOpeningTime: true,
  hasTicketPrice: true,
  hasFaq: true,
  hasPracticalNotes: true,
  hasTicketLinks: true,
  hasTag: true,
  hasFeaturedChild: false,
};

describe("computeCoverageScore (destination-spec §2.2.2)", () => {
  it("POI du 10 muc -> 100%, khong co muc featured-child", () => {
    const result = computeCoverageScore(FULL);
    expect(result.tier).toBe("poi");
    expect(result.scorePercent).toBe(100);
    expect(result.items).toHaveLength(10);
    expect(result.items.some((i) => i.key === "featured-child")).toBe(false);
  });

  it("POI thieu 1 muc -> 90%", () => {
    const result = computeCoverageScore({ ...FULL, hasTag: false });
    expect(result.scorePercent).toBe(90);
    expect(result.items.find((i) => i.key === "tag")?.done).toBe(false);
  });

  it("cluster/province (tier flagship) co them muc featured-child (11 muc)", () => {
    const result = computeCoverageScore({ ...FULL, kind: "cluster", hasFeaturedChild: true });
    expect(result.tier).toBe("flagship");
    expect(result.items).toHaveLength(11);
    expect(result.scorePercent).toBe(100);
  });

  it("flagship thieu featured-child -> khong dat 100%", () => {
    const result = computeCoverageScore({ ...FULL, kind: "province", hasFeaturedChild: false });
    expect(result.scorePercent).toBeLessThan(100);
  });

  it("khong co muc nao -> 0%", () => {
    const result = computeCoverageScore({
      kind: "poi",
      hasAddress: false,
      hasCoordinates: false,
      hasThumbnail: false,
      hasMainContent: false,
      hasOpeningTime: false,
      hasTicketPrice: false,
      hasFaq: false,
      hasPracticalNotes: false,
      hasTicketLinks: false,
      hasTag: false,
      hasFeaturedChild: false,
    });
    expect(result.scorePercent).toBe(0);
  });
});
