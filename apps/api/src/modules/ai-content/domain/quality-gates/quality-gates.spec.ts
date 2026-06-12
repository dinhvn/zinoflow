import type { Article } from "@zinoflow/contracts";
import {
  evaluateAllGates,
  evaluateDataGate,
  evaluatePolicyGate,
  evaluateSeoGate,
  evaluateStructureGate,
  type QualityGateInput,
} from "./quality-gates";
import { containsNormalized, normalizeVietnamese } from "./text-matching";

/** Bai viet hop le pass ca 4 gate — tung test pha dung 1 dieu kien. */
function validArticle(): Article {
  const longContent = Array(70).fill("nội dung chi tiết về sản phẩm và trải nghiệm").join(" ");
  return {
    hero: {
      title: "Top 5 túi xách nữ công sở bền đẹp đáng mua nhất 2026",
      subtitle: "Gợi ý túi xách nữ phù hợp đi làm hằng ngày.",
      affiliateDisclosure:
        "Bài viết có chứa liên kết tiếp thị liên kết, chúng tôi có thể nhận hoa hồng khi bạn mua qua liên kết.",
    },
    intent: {
      forWho: "Dành cho chị em văn phòng đang tìm túi xách nữ đi làm.",
      problem: "Khó chọn túi vừa bền vừa hợp túi tiền.",
    },
    quickAnswer: {
      bullets: ["Ưu tiên chất liệu da bền.", "So sánh giá trước khi mua.", "Kiểm tra bảo hành."],
    },
    sections: [
      { heading: "Tiêu chí xếp hạng", content: longContent },
      { heading: "Cách chọn theo ngân sách", content: longContent },
    ],
    productRecommendations: [
      {
        name: "Túi Tote A1",
        whyInList: "Bền, nhiều ngăn.",
        pros: ["Bền"],
        cons: ["Ít màu"],
        priceRange: "750.000đ",
        bestFor: "Dân văn phòng",
        productUrl: "https://laruki.com/san-pham/tui-tote-a1",
      },
    ],
    faq: [
      { question: "Nên chọn màu nào?", answer: "Màu trung tính dễ phối." },
      { question: "Giá bao nhiêu hợp lý?", answer: "Dưới 1 triệu cho lần đầu." },
      { question: "Mua ở đâu?", answer: "Mua tại website chính hãng." },
    ],
    finalCta: { text: "Xem giá mới nhất trước khi chốt.", action: "Xem sản phẩm" },
    metadata: {
      metaTitle: "Top 5 túi xách nữ công sở 2026",
      metaDescription: "Đánh giá chi tiết các mẫu túi xách nữ đáng mua.",
      slug: "top-5-tui-xach-nu-cong-so",
      internalLinkSuggestions: ["/cach-bao-quan-tui-da", "/phoi-do-cong-so"],
    },
  };
}

function validInput(overrides?: Partial<QualityGateInput>): QualityGateInput {
  const article = overrides?.article ?? validArticle();
  return {
    article,
    draftMarkdown:
      overrides?.draftMarkdown ??
      `# ${article.hero.title}\n\n${article.hero.affiliateDisclosure}\n\n` +
        article.sections.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n"),
    keywordSeed: overrides?.keywordSeed ?? ["túi xách nữ"],
  };
}

describe("Quality gates (spec §9 + §17.5)", () => {
  it("a valid article passes all 4 gates", () => {
    const { checks, allPassed } = evaluateAllGates(validInput());
    expect(allPassed).toBe(true);
    expect(checks.filter((c) => !c.passed)).toEqual([]);
  });

  describe("structure gate", () => {
    it("fails when markdown has more than one H1", () => {
      const input = validInput();
      const result = evaluateStructureGate({
        ...input,
        draftMarkdown: `# Tiêu đề 1\n\n# Tiêu đề 2\n\n${input.draftMarkdown}`,
      });
      expect(result.passed).toBe(false);
      expect(result.details.join(" ")).toContain("H1");
    });

    it("fails when a section is too short", () => {
      const article = validArticle();
      article.sections[0]!.content = "Nội dung quá ngắn nhưng vẫn đủ năm mươi ký tự để qua Zod schema.";
      const result = evaluateStructureGate(validInput({ article }));
      expect(result.passed).toBe(false);
      expect(result.details.join(" ")).toContain("quá ngắn");
    });

    it("fails when there are fewer than 2 sections", () => {
      const article = validArticle();
      article.sections = [article.sections[0]!];
      expect(evaluateStructureGate(validInput({ article })).passed).toBe(false);
    });
  });

  describe("seo gate", () => {
    it("matches primary keyword khong phan biet dau (unaccented keyword vs accented title)", () => {
      const result = evaluateSeoGate(validInput({ keywordSeed: ["tui xach nu"] }));
      expect(result.passed).toBe(true);
    });

    it("fails when primary keyword missing from H1", () => {
      const result = evaluateSeoGate(validInput({ keywordSeed: ["máy lọc không khí"] }));
      expect(result.passed).toBe(false);
      expect(result.details.join(" ")).toContain("tiêu đề H1");
    });

    it("fails when fewer than 2 internal links", () => {
      const article = validArticle();
      article.metadata.internalLinkSuggestions = ["/mot-link"];
      expect(evaluateSeoGate(validInput({ article })).passed).toBe(false);
    });

    it("skips keyword checks when keywordSeed is empty", () => {
      expect(evaluateSeoGate(validInput({ keywordSeed: [] })).passed).toBe(true);
    });
  });

  describe("policy gate", () => {
    it("fails without affiliate disclosure", () => {
      const article = validArticle();
      article.hero.affiliateDisclosure = "quá ngắn"; // < 10 ky tu
      expect(evaluatePolicyGate(validInput({ article })).passed).toBe(false);
    });

    it("fails when content contains banned phrase (ke ca viet khong dau)", () => {
      const input = validInput();
      const result = evaluatePolicyGate({
        ...input,
        draftMarkdown: input.draftMarkdown + "\n\nSan pham nay cam ket 100% hieu qua.",
      });
      expect(result.passed).toBe(false);
      expect(result.details.join(" ")).toContain("cam kết 100%");
    });
  });

  describe("data gate", () => {
    it("fails when product URL is a placeholder", () => {
      const article = validArticle();
      article.productRecommendations[0]!.productUrl = "https://example.com/placeholder";
      const result = evaluateDataGate(validInput({ article }));
      expect(result.passed).toBe(false);
      expect(result.details.join(" ")).toContain("placeholder");
    });

    it("fails when product URL is malformed", () => {
      const article = validArticle();
      article.productRecommendations[0]!.productUrl = "khong-phai-url";
      expect(evaluateDataGate(validInput({ article })).passed).toBe(false);
    });

    it("fails when an FAQ answer is empty", () => {
      const article = validArticle();
      article.faq[0]!.answer = "   ";
      expect(evaluateDataGate(validInput({ article })).passed).toBe(false);
    });
  });
});

describe("text-matching helpers", () => {
  it("normalizes Vietnamese diacritics and case", () => {
    expect(normalizeVietnamese("Túi Xách NỮ Đẹp")).toBe("tui xach nu dep");
  });

  it("containsNormalized matches across accent variants", () => {
    expect(containsNormalized("Top túi xách nữ đẹp", "tui xach nu")).toBe(true);
    expect(containsNormalized("Top tui xach nu dep", "túi xách nữ")).toBe(true);
    expect(containsNormalized("Bài về giày", "túi xách")).toBe(false);
  });
});
