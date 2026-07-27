import { isLikelySameDestinationName } from "./fuzzy-match-destination-name";

describe("isLikelySameDestinationName", () => {
  it("matches identical names after normalize", () => {
    expect(isLikelySameDestinationName("Hòn Rơm", "hon rom")).toBe(true);
  });

  it("matches when one name contains the other", () => {
    expect(isLikelySameDestinationName("Chùa Linh Ứng", "Linh Ứng Tự")).toBe(true);
  });

  it("matches on high token overlap", () => {
    expect(isLikelySameDestinationName("Bãi biển Mũi Né", "Mũi Né")).toBe(true);
  });

  it("does not match clearly different names", () => {
    expect(isLikelySameDestinationName("Hòn Rơm", "Tháp Pô Sah Inư")).toBe(false);
  });

  it("does not match empty strings", () => {
    expect(isLikelySameDestinationName("", "Hòn Rơm")).toBe(false);
  });
});
