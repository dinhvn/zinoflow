import { getArticleTypeProfile } from "./article-type-profiles";

describe("createManualSkeleton (dichoithoi-article-spec.md §1.1)", () => {
  it.each(["toplist", "review", "guide-diem-den", "cam-nang", "km-bai-viet"] as const)(
    "tra ve khung bai hop le qua schema cho articleType=%s",
    (articleType) => {
      const profile = getArticleTypeProfile(articleType);
      expect(() => profile.createManualSkeleton("Chủ đề thử nghiệm bài viết tay")).not.toThrow();
    },
  );

  it("dung topic ngan (5 ky tu, gioi han toi thieu request) van qua duoc schema", () => {
    const profile = getArticleTypeProfile("guide-diem-den");
    expect(() => profile.createManualSkeleton("Đảo A")).not.toThrow();
  });
});
