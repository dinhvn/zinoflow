import type { DestinationArticle } from "@zinoflow/contracts";
import { extractOriginalityExcerpt } from "./originality-excerpt";

function baseArticle(overrides: Partial<DestinationArticle> = {}): DestinationArticle {
  return {
    title: "Thác Pongour: kinh nghiệm tham quan",
    intro: "Thác Pongour là ngọn thác hùng vĩ bậc nhất Tây Nguyên, nằm tại Lâm Đồng.",
    quickFacts: {
      openingTime: "6:00 - 18:00",
      ticketPrice: "20.000đ (có thể thay đổi)",
      transport: "Cách Đà Lạt khoảng 50km về hướng Nam.",
      food: "Có vài quán nước nhỏ gần khu vực đón khách.",
      hotel: "Không có, nên ở Đà Lạt và đi trong ngày.",
      tip: "Nên đi vào mùa mưa để thác đẹp nhất.",
    },
    sections: [
      { heading: "Giới thiệu tổng quan", content: "Nội dung tổng quan về thác." },
      {
        heading: "Câu chuyện văn hoá - lịch sử",
        content: "Truyền thuyết về vị vua K'Ho và ngọn thác này được lưu truyền qua nhiều thế hệ.",
      },
    ],
    faq: [
      { question: "Đi mùa nào đẹp?", answer: "Mùa mưa, khoảng tháng 6-10." },
      { question: "Có mất phí không?", answer: "Có, 20.000đ/người." },
      { question: "Xa Đà Lạt không?", answer: "Khoảng 50km, chạy xe máy 1.5 giờ." },
    ],
    updateNotice: "Cập nhật tháng 6/2026, giá vé có thể thay đổi.",
    metadata: {
      name: "Thác Pongour",
      slugSuggestion: "thac-pongour",
      metaTitle: "Thác Pongour: kinh nghiệm tham quan chi tiết",
      metaDescription: "Kinh nghiệm tham quan thác Pongour: giá vé, đường đi, lưu ý thực tế cho chuyến đi.",
      description: "Thác Pongour là ngọn thác hùng vĩ bậc nhất Tây Nguyên, điểm đến nổi tiếng tại Lâm Đồng.",
      searchKeyword: "thác pongour, du lịch lâm đồng",
    },
    ...overrides,
  };
}

describe("extractOriginalityExcerpt", () => {
  it("noi mo bai + section co rui ro trung lap (van hoa - lich su)", () => {
    const excerpt = extractOriginalityExcerpt(baseArticle());
    expect(excerpt).toContain("Thác Pongour là ngọn thác hùng vĩ");
    expect(excerpt).toContain("Truyền thuyết về vị vua K'Ho");
  });

  it("chi lay mo bai khi khong co section rui ro nao", () => {
    const article = baseArticle({
      sections: [{ heading: "Giới thiệu tổng quan", content: "Nội dung tổng quan về thác." }],
    });
    const excerpt = extractOriginalityExcerpt(article);
    expect(excerpt).toBe(article.intro);
  });

  it("uu tien section mua/thoi diem khi bai Flagship khong co section van hoa", () => {
    const article = baseArticle({
      sections: [
        { heading: "Giới thiệu tổng quan", content: "Nội dung tổng quan." },
        { heading: "Nên đi mùa nào", content: "Mùa khô từ tháng 12 đến tháng 4 là đẹp nhất để tham quan." },
      ],
    });
    const excerpt = extractOriginalityExcerpt(article);
    expect(excerpt).toContain("Mùa khô từ tháng 12");
  });
});
