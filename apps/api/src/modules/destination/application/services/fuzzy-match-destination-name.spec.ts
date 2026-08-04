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

  describe("ignoreTokens (cluster-name stripping, bug 04/08/2026)", () => {
    const clusterTokens = new Set(["bao", "loc"]);

    it("does not match two different POIs that only share the cluster name suffix", () => {
      expect(
        isLikelySameDestinationName("Đèo Bảo Lộc", "Tượng Đức Mẹ Đèo Bảo Lộc", clusterTokens),
      ).toBe(false);
      expect(isLikelySameDestinationName("Đèo Bảo Lộc", "Đồi Dổi Bảo Lộc", clusterTokens)).toBe(false);
    });

    it("still matches a real abbreviation unrelated to the cluster name", () => {
      expect(isLikelySameDestinationName("Thác Damb'ri", "Damb'ri", clusterTokens)).toBe(true);
    });

    it("still matches when neither name touches the cluster name tokens", () => {
      expect(isLikelySameDestinationName("Chùa Linh Ứng", "Linh Ứng Tự", clusterTokens)).toBe(true);
    });
  });
});
