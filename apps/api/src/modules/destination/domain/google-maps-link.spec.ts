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

  it("chon block !3d!4d gan viewport nhat khi URL co nhieu block (bug Delight Park Dalat 22/07/2026)", () => {
    const url =
      "https://www.google.com/maps/place/Delight+Park+Dalat/@11.9587554,108.4730686,17z/data=!4m14!1m7!3m6!1s0x3171133e5090ba29:0x2be50419c9e40550!2zS2h1IGR1IGzhu4tjaCBMw6EgUGhvbmc!8m2!3d11.9285753!4d108.4516514!16s%2Fg%2F11dzl_w7np!3m5!1s0x317113d56bc9cb83:0xc773b8352053e5e4!8m2!3d11.9582632!4d108.4744012!16s%2Fg%2F11lzt5jvbf?entry=ttu&g_ep=EgoyMDI2MDcxOS4wIKXMDSoASAFQAw%3D%3D";
    expect(parseGoogleMapsCoords(url)).toEqual({ lat: 11.9582632, lng: 108.4744012 });
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
