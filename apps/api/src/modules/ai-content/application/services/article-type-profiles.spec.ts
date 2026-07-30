import { getArticleTypeProfile } from "./article-type-profiles";
import type { DestinationArticle } from "@zinoflow/contracts";

describe("createManualSkeleton (dichoithoi-article-spec.md §1.1)", () => {
  it.each([
    "toplist",
    "review",
    "guide-diem-den",
    "cam-nang",
    "km-bai-viet",
  ] as const)(
    "tra ve khung bai hop le qua schema cho articleType=%s",
    (articleType) => {
      const profile = getArticleTypeProfile(articleType);
      expect(() =>
        profile.createManualSkeleton("Chủ đề thử nghiệm bài viết tay"),
      ).not.toThrow();
    },
  );

  it("dung topic ngan (5 ky tu, gioi han toi thieu request) van qua duoc schema", () => {
    const profile = getArticleTypeProfile("guide-diem-den");
    expect(() => profile.createManualSkeleton("Đảo A")).not.toThrow();
  });
});

describe("destination normalizeArticle", () => {
  it("xoa items cua block thieu structured source va giu block co nguon", () => {
    const profile = getArticleTypeProfile("guide-diem-den");
    const skeleton = profile.createManualSkeleton(
      "Điểm đến thử nghiệm",
    ) as DestinationArticle;
    const article = {
      ...skeleton,
      quickFacts: {
        ...skeleton.quickFacts,
        food: "Bạn nên tự chuẩn bị đồ ăn.",
      },
      sections: skeleton.sections.map((section) => ({
        ...section,
        items: [{ ten: "Mục AI tự thêm", moTa: "Không có trong nguồn." }],
      })),
      faq: [
        {
          question: "Có dịch vụ cho thuê lều không?",
          answer: "Bạn nên tự chuẩn bị.",
        },
        { question: "Điểm gần nhất là đâu?", answer: "Điểm A cách 2 km." },
      ],
    };

    const normalized = profile.normalizeArticle!(
      article,
      "- activities: missing-structured-source\n- food: check-reviewed-summary\n- souvenirs: missing-structured-source",
    ) as DestinationArticle;
    const sections = normalized.sections;

    expect(
      sections.find((section) => section.blockKey === "trai-nghiem")?.items,
    ).toEqual([]);
    expect(
      sections.find((section) => section.blockKey === "an-gi")?.items,
    ).toHaveLength(1);
    expect(
      sections.find((section) => section.blockKey === "qua-mang-ve")?.items,
    ).toEqual([]);
    expect(
      sections.find((section) => section.blockKey === "trai-nghiem")?.content,
    ).toContain("chưa có dữ liệu đã xác minh");
    expect(normalized.quickFacts.food).toBe("Bạn nên tự chuẩn bị đồ ăn.");
    expect(normalized.faq).toEqual([
      { question: "Điểm gần nhất là đâu?", answer: "Điểm A cách 2 km." },
    ]);
  });

  it("chuan hoa food lead va quick fact khi food thieu structured source", () => {
    const profile = getArticleTypeProfile("guide-diem-den");
    const article = profile.createManualSkeleton(
      "Điểm đến thử nghiệm",
    ) as DestinationArticle;
    const normalized = profile.normalizeArticle!(
      article,
      "- food: missing-structured-source",
    ) as DestinationArticle;

    expect(normalized.quickFacts.food).toBe(
      "Hiện chưa có dữ liệu đã xác minh về dịch vụ ăn uống tại điểm đến.",
    );
    expect(
      normalized.sections.find((section) => section.blockKey === "an-gi")
        ?.items,
    ).toEqual([]);
  });
});
