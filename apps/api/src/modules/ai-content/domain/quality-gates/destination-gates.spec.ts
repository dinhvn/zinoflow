import type { DestinationArticle } from "@zinoflow/contracts";
import { renderDestinationMarkdown } from "../../application/services/destination-markdown.renderer";
import {
  evaluateDestinationDataGate,
  evaluateDestinationGates,
  evaluateDestinationPolicyGate,
  evaluateDestinationSeoGate,
  evaluateDestinationStructureGate,
} from "./destination-gates";

const longContent = (topic: string): string =>
  `${topic} là điểm dừng chân được nhiều người yêu thích khi ghé thăm khu vực này. `.repeat(8);

function validArticle(overrides: Partial<DestinationArticle> = {}): DestinationArticle {
  return {
    title: "Vịnh Hạ Long: kinh nghiệm tham quan, giá vé, ăn gì 2026",
    intro:
      "Vịnh Hạ Long là di sản thiên nhiên thế giới nổi tiếng bậc nhất của Quảng Ninh, " +
      "nơi hàng nghìn đảo đá vôi nhô lên giữa làn nước xanh ngọc. Bài viết tổng hợp kinh nghiệm " +
      "tham quan thực tế, từ cách chọn tuyến du thuyền, thời điểm đẹp cho tới các lưu ý " +
      "khi mua vé, giúp bạn chuẩn bị chuyến đi trọn vẹn ngay từ lần đầu ghé thăm.",
    quickFacts: {
      openingTime: "Tuyến tham quan hoạt động 7:30 - 17:00 hằng ngày",
      ticketPrice: "Vé tuyến 1: 290.000đ/người lớn (có thể thay đổi)",
      transport: "Từ Hà Nội đi cao tốc Hải Phòng - Hạ Long khoảng 2,5 giờ; có xe limousine đưa đón tận nơi.",
      food: "Hải sản tươi tại chợ Hạ Long, chả mực giã tay là đặc sản nên thử.",
      hotel: "Khu Bãi Cháy nhiều khách sạn mọi phân khúc, gần bến tàu tham quan.",
      tip: "Mua vé tại bến chính thức; mang áo khoác mỏng vì trên vịnh gió mạnh.",
    },
    sections: [
      { heading: "Giới thiệu tổng quan", content: longContent("Vịnh Hạ Long") },
      { heading: "Chơi gì ở Vịnh Hạ Long", content: longContent("Hang Sửng Sốt") },
      { heading: "Thời điểm đẹp nhất để đi", content: longContent("Mùa thu") },
      { heading: "Câu chuyện văn hoá - lịch sử Vịnh Hạ Long", content: longContent("Truyền thuyết rồng hạ") },
    ],
    faq: [
      { question: "Đi Vịnh Hạ Long mùa nào đẹp?", answer: "Tháng 9-11 trời mát, biển lặng." },
      { question: "Tham quan mất bao lâu?", answer: "Tuyến ngắn 4 tiếng, ngủ đêm 2 ngày 1 đêm." },
      { question: "Có nên ngủ đêm trên du thuyền?", answer: "Nên, nếu ngân sách cho phép." },
    ],
    updateNotice:
      "Thông tin trong bài cập nhật tháng 6/2026, giá vé và giờ mở cửa có thể thay đổi.",
    metadata: {
      name: "Vịnh Hạ Long",
      slugSuggestion: "vinh-ha-long",
      metaTitle: "Vịnh Hạ Long: kinh nghiệm tham quan, giá vé 2026",
      metaDescription:
        "Kinh nghiệm tham quan Vịnh Hạ Long: giá vé các tuyến, thời điểm đẹp, ăn gì, ở đâu — tổng hợp từ trải nghiệm thực tế cho chuyến đi đầu tiên.",
      description:
        "Vịnh Hạ Long là di sản thiên nhiên thế giới với hàng nghìn đảo đá vôi, điểm đến không thể bỏ qua khi tới Quảng Ninh.",
      searchKeyword: "vịnh hạ long, du lịch hạ long, vé tham quan hạ long",
    },
    ...overrides,
  };
}

function gateInput(article: DestinationArticle, existingSlugs: string[] | null = null) {
  return {
    article,
    draftMarkdown: renderDestinationMarkdown(article),
    keywordSeed: [] as string[],
    existingSlugs,
  };
}

describe("destination gates (spec dichoithoi §6)", () => {
  it("passes all 4 gates voi bai hop le", () => {
    const { allPassed, checks } = evaluateDestinationGates(gateInput(validArticle()));
    expect(checks.filter((c) => !c.passed)).toEqual([]);
    expect(allPassed).toBe(true);
  });

  it("structure: fail khi thieu section (duoi 3)", () => {
    const article = validArticle();
    const result = evaluateDestinationStructureGate(
      gateInput({ ...article, sections: article.sections.slice(0, 2) }),
    );
    expect(result.passed).toBe(false);
    expect(result.details.join(" ")).toContain("ít nhất 3 section");
  });

  it("structure: fail khi thieu section cau chuyen van hoa - lich su", () => {
    const article = validArticle();
    const result = evaluateDestinationStructureGate(
      gateInput({ ...article, sections: article.sections.slice(0, 3) }),
    );
    expect(result.passed).toBe(false);
    expect(result.details.join(" ")).toContain("văn hoá - lịch sử");
  });

  it("seo: fail khi ten diem den khong co trong H1 (keyword mac dinh la ten)", () => {
    const article = validArticle({ title: "Kinh nghiệm du lịch biển miền Bắc 2026" });
    const result = evaluateDestinationSeoGate(gateInput(article));
    expect(result.passed).toBe(false);
    expect(result.details.join(" ")).toContain("tiêu đề H1");
  });

  it("policy: fail khi updateNotice khong co thang/nam", () => {
    const article = validArticle({ updateNotice: "Thông tin có thể thay đổi theo thời gian." });
    const result = evaluateDestinationPolicyGate(gateInput(article));
    expect(result.passed).toBe(false);
  });

  it("policy: fail khi gia ve khong kem luu y thay doi", () => {
    const article = validArticle({
      updateNotice: "Thông tin trong bài cập nhật tháng 6/2026.",
      quickFacts: { ...validArticle().quickFacts, ticketPrice: "290.000đ/người lớn" },
    });
    const result = evaluateDestinationPolicyGate(gateInput(article));
    expect(result.passed).toBe(false);
    expect(result.details.join(" ")).toContain("có thể thay đổi");
  });

  it("policy: chap nhan gia 'Mien phi' khong can luu y", () => {
    const article = validArticle({
      quickFacts: { ...validArticle().quickFacts, ticketPrice: "Miễn phí" },
    });
    expect(evaluateDestinationPolicyGate(gateInput(article)).passed).toBe(true);
  });

  it("policy: fail khi co claim tuyet doi", () => {
    const article = validArticle();
    article.sections[0] = {
      heading: "Giới thiệu tổng quan",
      content: `Đây là vịnh đẹp nhất Việt Nam mà ai cũng phải tới. ${longContent("Vịnh")}`,
    };
    const result = evaluateDestinationPolicyGate(gateInput(article));
    expect(result.passed).toBe(false);
    expect(result.details.join(" ")).toContain("đẹp nhất việt nam");
  });

  it("data: fail khi slug trung diem den dang ton tai (mode create)", () => {
    const result = evaluateDestinationDataGate(
      gateInput(validArticle(), ["vinh-ha-long", "ha-noi"]),
    );
    expect(result.passed).toBe(false);
    expect(result.details.join(" ")).toContain("đã tồn tại");
  });

  it("data: fail khi quick fact bo trong", () => {
    const article = validArticle({
      quickFacts: { ...validArticle().quickFacts, transport: "  " },
    });
    const result = evaluateDestinationDataGate(gateInput(article));
    expect(result.passed).toBe(false);
    expect(result.details.join(" ")).toContain("Di chuyển");
  });
});
