import {
  evaluateArticleCamNangSeoGate,
  evaluateArticleCamNangStructureGate,
} from "./article-camnang-gates";
import type { ArticleCamNang } from "@zinoflow/contracts";

const validArticle: ArticleCamNang = {
  title: "Các con thác đẹp tại Việt Nam",
  intro:
    "Việt Nam sở hữu rất nhiều con thác đẹp trải dài từ Bắc vào Nam, mỗi nơi mang một vẻ đẹp riêng " +
    "đáng để bạn khám phá ít nhất một lần trong đời khi có dịp du lịch.",
  metadata: {
    metaTitle: "Các con thác đẹp tại Việt Nam - Cẩm nang du lịch",
    metaDescription:
      "Tổng hợp các con thác đẹp tại Việt Nam đáng ghé thăm nhất, kèm hướng dẫn di chuyển và lưu ý khi tham quan.",
    slugSuggestion: "cac-con-thac-dep-tai-viet-nam",
    searchKeyword: "thác đẹp tại Việt Nam",
  },
  sections: [
    {
      heading: "Thác đẹp ở Lâm Đồng",
      content:
        "Lâm Đồng là nơi tập trung nhiều thác nước đẹp nổi tiếng, thu hút đông đảo khách du lịch mỗi năm " +
        "nhờ khí hậu mát mẻ quanh năm và cảnh quan thiên nhiên hùng vĩ, phù hợp cho các chuyến đi cuối tuần " +
        "hoặc kỳ nghỉ dài ngày cùng gia đình và bạn bè.\n\n" +
        "### Danh sách thác tiêu biểu\n" +
        "[[block:destinations type=thac-ho-suoi province=lam-dong limit=6]]",
    },
  ],
};

function toDraftMarkdown(article: ArticleCamNang): string {
  const lines = [`# ${article.title}`, "", article.intro, ""];
  for (const s of article.sections) lines.push(`## ${s.heading}`, "", s.content, "");
  return lines.join("\n");
}

describe("evaluateArticleCamNangStructureGate (spec §6)", () => {
  it("pass khi intro/section du dai va token co H2 ngay tren", () => {
    const result = evaluateArticleCamNangStructureGate({
      article: validArticle,
      draftMarkdown: toDraftMarkdown(validArticle),
      keywordSeed: ["thác đẹp"],
    });
    expect(result.passed).toBe(true);
  });

  it("fail khi token khong co H2/H3 ngay tren", () => {
    const article: ArticleCamNang = {
      ...validArticle,
      sections: [
        {
          heading: "Thác đẹp ở Lâm Đồng",
          content:
            "Đoạn văn giới thiệu không phải tiêu đề, chỉ là văn xuôi bình thường được viết thêm cho đủ " +
            "độ dài tối thiểu ba mươi từ theo yêu cầu của gate cấu trúc bài viết cẩm nang.\n" +
            "[[block:destinations type=thac-ho-suoi]]",
        },
      ],
    };
    const result = evaluateArticleCamNangStructureGate({
      article,
      draftMarkdown: toDraftMarkdown(article),
      keywordSeed: [],
    });
    expect(result.passed).toBe(false);
    expect(result.details[0]).toContain("H2/H3");
  });

  it("fail khi token cu phap sai (kind khong nhan dien duoc)", () => {
    const article: ArticleCamNang = {
      ...validArticle,
      sections: [
        {
          heading: "Mục không hợp lệ",
          content:
            "Giới thiệu về mục này để đủ độ dài tối thiểu ba mươi từ cho section theo yêu cầu gate " +
            "cấu trúc, tránh bị báo lỗi section quá ngắn khi kiểm tra cú pháp token bên dưới.\n" +
            "[[block:unknown foo=bar]]",
        },
      ],
    };
    const result = evaluateArticleCamNangStructureGate({
      article,
      draftMarkdown: toDraftMarkdown(article),
      keywordSeed: [],
    });
    expect(result.passed).toBe(false);
    expect(result.details.some((d) => d.includes("cú pháp"))).toBe(true);
  });
});

describe("evaluateArticleCamNangSeoGate (spec §6)", () => {
  it("pass khi keyword xuat hien trong title/intro va slug hop le", () => {
    const result = evaluateArticleCamNangSeoGate({
      article: validArticle,
      draftMarkdown: toDraftMarkdown(validArticle),
      keywordSeed: ["thác đẹp"],
    });
    expect(result.passed).toBe(true);
  });

  it("fail khi slug khong hop le", () => {
    const article: ArticleCamNang = {
      ...validArticle,
      metadata: { ...validArticle.metadata, slugSuggestion: "Slug Sai Dinh Dang" },
    };
    const result = evaluateArticleCamNangSeoGate({
      article,
      draftMarkdown: toDraftMarkdown(article),
      keywordSeed: ["thác đẹp"],
    });
    expect(result.passed).toBe(false);
  });
});
