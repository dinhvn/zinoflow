import { computeCoverageScore, type CoverageInput } from "./coverage-score";

const FULL: CoverageInput = {
  kind: "poi",
  contentTier: null,
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
  hasItinerary: false,
  hasArticleTopicCoverage: false,
  hasEditorialReview: false,
  hasExternalReviewUrl: false,
};

const FULL_FLAGSHIP: CoverageInput = {
  ...FULL,
  kind: "cluster",
  contentTier: "flagship",
  hasFeaturedChild: true,
  hasItinerary: true,
  hasArticleTopicCoverage: true,
  hasEditorialReview: true,
  hasExternalReviewUrl: true,
};

describe("computeCoverageScore (destination-spec §2.2.2)", () => {
  it("POI du 10 muc -> 100%, khong co 5 muc rieng Flagship", () => {
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

  it("cluster/province voi ContentTier=flagship co them 5 muc rieng (15 muc)", () => {
    const result = computeCoverageScore(FULL_FLAGSHIP);
    expect(result.tier).toBe("flagship");
    expect(result.items).toHaveLength(15);
    expect(result.scorePercent).toBe(100);
  });

  it("cluster/province voi ContentTier=standard hoac null la tier standard, KHONG co 5 muc Flagship", () => {
    const standard = computeCoverageScore({ ...FULL, kind: "cluster", contentTier: "standard" });
    expect(standard.tier).toBe("standard");
    expect(standard.items).toHaveLength(10);

    const nullTier = computeCoverageScore({ ...FULL, kind: "province", contentTier: null });
    expect(nullTier.tier).toBe("standard");
    expect(nullTier.items).toHaveLength(10);
  });

  it("flagship thieu 1 trong 5 muc rieng -> khong dat 100%", () => {
    const result = computeCoverageScore({ ...FULL_FLAGSHIP, hasItinerary: false });
    expect(result.scorePercent).toBeLessThan(100);
    expect(result.items.find((i) => i.key === "itinerary")?.done).toBe(false);
  });

  it("khong co muc nao -> 0%", () => {
    const result = computeCoverageScore({
      kind: "poi",
      contentTier: null,
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
      hasItinerary: false,
      hasArticleTopicCoverage: false,
      hasEditorialReview: false,
      hasExternalReviewUrl: false,
    });
    expect(result.scorePercent).toBe(0);
  });
});
