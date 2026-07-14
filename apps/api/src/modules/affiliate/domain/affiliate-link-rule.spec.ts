import {
  resolveAffiliateLink,
  type AffiliateNetworkRule,
  type AffiliatePartnerRule,
} from "./affiliate-link-rule";

describe("resolveAffiliateLink v2 (doi tac -> mang -> template) — affiliate-provider-management §3", () => {
  const accesstrade: AffiliateNetworkRule = {
    id: "net-1",
    template: "https://go.isclix.com/deep_link/123?url={url_enc}",
    placeholder: "{url_enc}",
    isActive: true,
  };
  const bookingDirect: AffiliateNetworkRule = {
    id: "net-2",
    template: "https://www.booking.com/aid/999?url={url}",
    placeholder: "{url}",
    isActive: true,
  };
  const inactiveNetwork: AffiliateNetworkRule = { ...accesstrade, id: "net-3", isActive: false };

  const klook: AffiliatePartnerRule = {
    code: "klook",
    matchDomain: "klook.com",
    networkId: "net-1",
    isActive: true,
  };
  const booking: AffiliatePartnerRule = {
    code: "booking",
    matchDomain: "booking.com",
    networkId: "net-2",
    isActive: true,
  };
  const noNetworkPartner: AffiliatePartnerRule = {
    code: "agoda",
    matchDomain: "agoda.com",
    networkId: null,
    isActive: true,
  };

  it("khop doi tac theo domain, ap template cua MANG doi tac do (khong phai cua rieng doi tac)", () => {
    const result = resolveAffiliateLink(
      "https://www.klook.com/activity/123",
      [klook, booking],
      [accesstrade, bookingDirect],
    );
    expect(result).toEqual({
      provider: "klook",
      affiliateUrl:
        "https://go.isclix.com/deep_link/123?url=" +
        encodeURIComponent("https://www.klook.com/activity/123"),
      linkStatus: "converted",
    });
  });

  it("2 doi tac CUNG mang -> dung chung 1 template (dac diem cot loi cua model v2)", () => {
    const vexere: AffiliatePartnerRule = {
      code: "vexere",
      matchDomain: "vexere.com",
      networkId: "net-1",
      isActive: true,
    };
    const result = resolveAffiliateLink(
      "https://vexere.com/ve/1",
      [klook, vexere],
      [accesstrade],
      "vexere",
    );
    expect(result.linkStatus).toBe("converted");
    expect(result.affiliateUrl).toContain("go.isclix.com/deep_link/123");
  });

  it("giu nguyen sourceUrl khi placeholder la {url}", () => {
    const result = resolveAffiliateLink(
      "https://www.booking.com/hotel/vn/abc.html",
      [booking],
      [bookingDirect],
    );
    expect(result.affiliateUrl).toBe(
      "https://www.booking.com/aid/999?url=https://www.booking.com/hotel/vn/abc.html",
    );
    expect(result.linkStatus).toBe("converted");
  });

  it("khong khop doi tac nao -> giu nguyen sourceUrl, danh dau no-rule", () => {
    const result = resolveAffiliateLink("https://www.tripvision.vn/tour/1", [klook, booking], [
      accesstrade,
      bookingDirect,
    ]);
    expect(result).toEqual({
      provider: "other",
      affiliateUrl: "https://www.tripvision.vn/tour/1",
      linkStatus: "no-rule",
    });
  });

  it("doi tac ton tai nhung chua gan mang (networkId=null) -> no-rule", () => {
    const result = resolveAffiliateLink("https://agoda.com/hotel/1", [noNetworkPartner], []);
    expect(result.provider).toBe("agoda");
    expect(result.linkStatus).toBe("no-rule");
  });

  it("doi tac gan mang nhung mang dang tat -> no-rule", () => {
    const partner: AffiliatePartnerRule = { ...klook, networkId: "net-3" };
    const result = resolveAffiliateLink("https://www.klook.com/activity/456", [partner], [
      inactiveNetwork,
    ]);
    expect(result.linkStatus).toBe("no-rule");
  });

  it("bo qua doi tac dang tat (isActive=false)", () => {
    const partner: AffiliatePartnerRule = { ...klook, isActive: false };
    const result = resolveAffiliateLink("https://www.klook.com/activity/456", [partner], [
      accesstrade,
    ]);
    expect(result.linkStatus).toBe("no-rule");
  });

  it("chi dinh provider tuong minh -> dung dung doi tac do, khong tu nhan dien domain", () => {
    const result = resolveAffiliateLink(
      "https://example.com/xyz",
      [klook, booking],
      [accesstrade, bookingDirect],
      "klook",
    );
    expect(result.provider).toBe("klook");
    expect(result.linkStatus).toBe("converted");
  });

  it("provider chi dinh khong ton tai trong danh sach doi tac -> no-rule", () => {
    const result = resolveAffiliateLink("https://example.com/xyz", [klook], [accesstrade], "agoda");
    expect(result.linkStatus).toBe("no-rule");
    expect(result.provider).toBe("agoda");
  });
});
