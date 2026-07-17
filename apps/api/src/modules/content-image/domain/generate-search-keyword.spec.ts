import { generateSearchKeyword } from "./generate-search-keyword";

describe("generateSearchKeyword (auto-image-search-plan.md §2.2)", () => {
  it("tach tu tieu de, bo dau, them hau to vietnam travel", () => {
    expect(generateSearchKeyword("Các con thác đẹp tại Đà Lạt")).toBe(
      "con thac dep da lat vietnam travel",
    );
  });

  it("loai bo stop-word chung chung (kinh nghiem, o...)", () => {
    expect(generateSearchKeyword("Kinh nghiệm ăn uống ở Đà Lạt")).toBe(
      "an uong da lat vietnam travel",
    );
  });

  it("van tra ve tu khoa hop le khi toan bo tu deu la stop-word", () => {
    const result = generateSearchKeyword("Top nhất");
    expect(result).toContain("vietnam travel");
    expect(result.trim().length).toBeGreaterThan("vietnam travel".length);
  });
});
