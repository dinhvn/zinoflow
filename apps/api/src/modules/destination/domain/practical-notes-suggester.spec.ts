import { suggestPracticalNotes } from "./practical-notes-suggester";

describe("suggestPracticalNotes", () => {
  it("goi y song lon/cuu ho cho diem co tu khoa bien", () => {
    const result = suggestPracticalNotes({ name: "Bãi biển Mỹ Khê", shortDescription: null });
    expect(result.some((n) => n.label === "Sóng và dòng chảy")).toBe(true);
    expect(result.some((n) => n.label === "Cứu hộ")).toBe(true);
  });

  it("goi y duong tron/do cao cho diem co tu khoa nui", () => {
    const result = suggestPracticalNotes({ name: "Núi Bà Đen", shortDescription: null });
    expect(result.some((n) => n.label === "Đường đi")).toBe(true);
    expect(result.some((n) => n.label === "Độ cao")).toBe(true);
  });

  it("goi y trang phuc/gio le cho diem co tu khoa chua/den", () => {
    const result = suggestPracticalNotes({
      name: "Điểm đến bất kỳ",
      shortDescription: "Ngôi chùa cổ nổi tiếng",
    });
    expect(result.some((n) => n.label === "Trang phục")).toBe(true);
  });

  it("luon co 2 muc chung bai xe/nha ve sinh du khong khop nhom nao", () => {
    const result = suggestPracticalNotes({ name: "Một điểm đến bất kỳ", shortDescription: null });
    expect(result.some((n) => n.label === "Bãi đỗ xe")).toBe(true);
    expect(result.some((n) => n.label === "Nhà vệ sinh")).toBe(true);
  });

  it("khong trung lap nhom khi ten khop nhieu tu khoa cung nhom", () => {
    const result = suggestPracticalNotes({ name: "Bãi biển - Vịnh", shortDescription: null });
    expect(result.filter((n) => n.label === "Sóng và dòng chảy")).toHaveLength(1);
  });
});
