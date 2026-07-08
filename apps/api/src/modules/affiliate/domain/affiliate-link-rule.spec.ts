import { resolveAffiliateLink, type AffiliateLinkRule } from "./affiliate-link-rule";

describe("resolveAffiliateLink (spec affiliate-link-conversion §3)", () => {
  const klookRule: AffiliateLinkRule = {
    id: "r1",
    provider: "klook",
    matchDomain: "klook.com",
    template: "https://www.klook.com/aff/123456/?url={url_enc}",
    placeholder: "{url_enc}",
    isActive: true,
  };
  const bookingRule: AffiliateLinkRule = {
    id: "r2",
    provider: "booking",
    matchDomain: "booking.com",
    template: "https://www.booking.com/aid/999?url={url}",
    placeholder: "{url}",
    isActive: true,
  };
  const inactiveRule: AffiliateLinkRule = { ...klookRule, id: "r3", isActive: false };

  it("khop rule theo domain va URL-encode sourceUrl khi placeholder la {url_enc}", () => {
    const result = resolveAffiliateLink("https://www.klook.com/activity/123", [klookRule]);
    expect(result).toEqual({
      provider: "klook",
      affiliateUrl:
        "https://www.klook.com/aff/123456/?url=" +
        encodeURIComponent("https://www.klook.com/activity/123"),
      linkStatus: "converted",
    });
  });

  it("giu nguyen sourceUrl khi placeholder la {url}", () => {
    const result = resolveAffiliateLink("https://www.booking.com/hotel/vn/abc.html", [
      bookingRule,
    ]);
    expect(result.affiliateUrl).toBe(
      "https://www.booking.com/aid/999?url=https://www.booking.com/hotel/vn/abc.html",
    );
    expect(result.linkStatus).toBe("converted");
  });

  it("khong khop rule nao -> giu nguyen sourceUrl, danh dau no-rule (khong bia du lieu)", () => {
    const result = resolveAffiliateLink("https://www.tripvision.vn/tour/1", [klookRule, bookingRule]);
    expect(result).toEqual({
      provider: "other",
      affiliateUrl: "https://www.tripvision.vn/tour/1",
      linkStatus: "no-rule",
    });
  });

  it("bo qua rule dang tat (isActive=false)", () => {
    const result = resolveAffiliateLink("https://www.klook.com/activity/456", [inactiveRule]);
    expect(result.linkStatus).toBe("no-rule");
  });

  it("chi dinh provider tuong minh -> dung dung rule do, khong tu nhan dien domain", () => {
    const result = resolveAffiliateLink(
      "https://example.com/xyz",
      [klookRule, bookingRule],
      "klook",
    );
    expect(result.provider).toBe("klook");
    expect(result.linkStatus).toBe("converted");
  });

  it("provider chi dinh khong ton tai trong danh sach rule -> no-rule", () => {
    const result = resolveAffiliateLink("https://example.com/xyz", [klookRule], "agoda");
    expect(result.linkStatus).toBe("no-rule");
    expect(result.provider).toBe("agoda");
  });
});
