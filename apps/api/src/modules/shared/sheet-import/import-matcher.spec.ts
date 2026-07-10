import { matchImportRow, type ImportMatchCandidate } from "./import-matcher";

describe("matchImportRow (product-spec §5.1 — UPSERT theo sourceUrl + khoa phu)", () => {
  const existing: ImportMatchCandidate[] = [
    { id: "h1", sourceUrl: "https://booking.com/a", name: "Khách sạn Biển Xanh", provinceCode: "40" },
  ];

  it("khop dung sourceUrl -> update", () => {
    const result = matchImportRow(existing, {
      sourceUrl: "https://booking.com/a",
      name: "Khách Sạn Biển Xanh (đổi tên)",
      provinceCode: "40",
    });
    expect(result).toEqual({ type: "update", matchedId: "h1" });
  });

  it("sourceUrl khac nhung trung ten (chuan hoa) + tinh -> needsConfirm", () => {
    const result = matchImportRow(existing, {
      sourceUrl: "https://agoda.com/b",
      name: "khach san bien xanh",
      provinceCode: "40",
    });
    expect(result.type).toBe("needsConfirm");
    expect((result as { matchedId: string }).matchedId).toBe("h1");
  });

  it("trung ten nhung khac tinh -> khong khop, tao moi", () => {
    const result = matchImportRow(existing, {
      sourceUrl: "https://agoda.com/c",
      name: "Khách sạn Biển Xanh",
      provinceCode: "79",
    });
    expect(result).toEqual({ type: "create" });
  });

  it("ca 2 ben deu khong co tinh (null) nhung trung ten -> KHONG tu goi y gop, tao moi", () => {
    const noProvince: ImportMatchCandidate[] = [
      { id: "h2", sourceUrl: "https://booking.com/x", name: "Khách Sạn Hoa Sen", provinceCode: null },
    ];
    const result = matchImportRow(noProvince, {
      sourceUrl: "https://agoda.com/y",
      name: "Khách Sạn Hoa Sen",
      provinceCode: null,
    });
    expect(result).toEqual({ type: "create" });
  });

  it("khong khop gi ca -> create", () => {
    const result = matchImportRow(existing, {
      sourceUrl: "https://agoda.com/d",
      name: "Khách sạn Núi Trắng",
      provinceCode: "01",
    });
    expect(result).toEqual({ type: "create" });
  });
});
