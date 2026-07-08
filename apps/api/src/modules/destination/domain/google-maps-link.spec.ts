import { isShortGoogleMapsLink, parseGoogleMapsCoords } from "./google-maps-link";

describe("parseGoogleMapsCoords", () => {
  it("uu tien toa do ghim !3d!4d khi co ca 2 dinh dang", () => {
    const url =
      "https://www.google.com/maps/place/Su%E1%BB%91i+Ti%C3%AAn/@10.8661916,106.8005929,17z/data=!4m6!3m5!1s0x0:0x0!8m2!3d10.870000!4d106.810000";
    expect(parseGoogleMapsCoords(url)).toEqual({ lat: 10.87, lng: 106.81 });
  });

  it("fallback ve @lat,lng khi khong co !3d!4d", () => {
    const url = "https://www.google.com/maps/place/C%C3%B4ng+vi%C3%AAn/@10.8661916,106.8005929,17z";
    expect(parseGoogleMapsCoords(url)).toEqual({ lat: 10.8661916, lng: 106.8005929 });
  });

  it("tra ve null khi khong khop dinh dang nao", () => {
    expect(parseGoogleMapsCoords("https://example.com/khong-lien-quan")).toBeNull();
  });

  it("tra ve null khi toa do vuot ngoai khoang hop le", () => {
    expect(parseGoogleMapsCoords("https://www.google.com/maps/@999,999,17z")).toBeNull();
  });
});

describe("isShortGoogleMapsLink", () => {
  it("nhan dien maps.app.goo.gl", () => {
    expect(isShortGoogleMapsLink("https://maps.app.goo.gl/abc123")).toBe(true);
  });

  it("nhan dien goo.gl", () => {
    expect(isShortGoogleMapsLink("https://goo.gl/maps/abc123")).toBe(true);
  });

  it("khong nhan dien link Google Maps day du", () => {
    expect(isShortGoogleMapsLink("https://www.google.com/maps/place/x/@10,106,17z")).toBe(false);
  });

  it("tra ve false voi URL khong hop le", () => {
    expect(isShortGoogleMapsLink("khong-phai-url")).toBe(false);
  });
});
