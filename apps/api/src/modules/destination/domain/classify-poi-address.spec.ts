import { classifyPoiAddress } from "./classify-poi-address";

describe("classifyPoiAddress", () => {
  const wardMappings = [
    { oldWardName: "Xã Đại Lãnh", newWardName: "Xã Vạn Ninh" },
    { oldWardName: "Phường Vĩnh Hòa", newWardName: "Phường Nha Trang" },
  ];
  const newWardNames = ["Phường Nha Trang", "Xã Vạn Ninh", "Phường Cam Ranh"];

  it("dia chi chua ten phuong CU -> AddressOld = nguyen van, AddressNew = da thay ten phuong moi", () => {
    const result = classifyPoiAddress("123 Trần Phú, Đại Lãnh, Khánh Hòa", newWardNames, wardMappings);

    expect(result.addressOld).toBe("123 Trần Phú, Đại Lãnh, Khánh Hòa");
    expect(result.addressNew).toBe("123 Trần Phú, Xã Vạn Ninh, Khánh Hòa");
  });

  it("dia chi chua ten phuong MOI -> AddressNew = nguyen van, AddressOld = null", () => {
    const result = classifyPoiAddress("45 Nguyễn Thiện Thuật, Nha Trang", newWardNames, wardMappings);

    expect(result.addressNew).toBe("45 Nguyễn Thiện Thuật, Nha Trang");
    expect(result.addressOld).toBeNull();
  });

  it("khong khop duoc phuong cu lan phuong moi -> giu nguyen ve AddressNew, KHONG bia AddressOld", () => {
    const result = classifyPoiAddress("Số 7 đường ven biển", newWardNames, wardMappings);

    expect(result.addressNew).toBe("Số 7 đường ven biển");
    expect(result.addressOld).toBeNull();
  });

  it("nhieu phuong cu cung khop -> chon phuong xuat hien som nhat trong chuoi", () => {
    // "Đại Lãnh" (idx sau) vs "Vĩnh Hòa" (idx truoc) — Vinh Hoa xuat hien truoc trong chuoi.
    const result = classifyPoiAddress(
      "Vĩnh Hòa gần ranh giới Đại Lãnh, Khánh Hòa",
      newWardNames,
      wardMappings,
    );

    expect(result.addressOld).toBe("Vĩnh Hòa gần ranh giới Đại Lãnh, Khánh Hòa");
    expect(result.addressNew).toContain("Phường Nha Trang");
  });

  it("ten phuong qua ngan (<3 ky tu sau khi bo tien to) khong duoc dung de khop, tranh false-positive", () => {
    const shortWardMappings = [{ oldWardName: "Xã Cà", newWardName: "Phường Cà Mau Mới" }];
    const result = classifyPoiAddress("Quán cà phê ABC", [], shortWardMappings);

    expect(result.addressOld).toBeNull();
    expect(result.addressNew).toBe("Quán cà phê ABC");
  });
});
