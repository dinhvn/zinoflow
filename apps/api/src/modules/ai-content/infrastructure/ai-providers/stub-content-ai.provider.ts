import { Injectable } from "@nestjs/common";
import { articleSchema, type Article, type ArticleOutline } from "@zinoflow/contracts";
import type {
  AiCallUsage,
  ContentAiProvider,
  GenerateArticleInput,
  GenerateOutlineInput,
} from "../../application/ports/content-ai-provider.port";

/**
 * Stub provider — sinh bai viet deterministic, KHONG goi API that.
 * Dung de: (1) test pipeline khong ton tien, (2) fallback khi provider chua co key.
 * Output luon pass articleSchema (co test bao ve dieu nay).
 */
@Injectable()
export class StubContentAiProvider implements ContentAiProvider {
  readonly key = "stub" as const;

  isConfigured(): boolean {
    return true; // stub luon san sang
  }

  async generateOutline(
    input: GenerateOutlineInput,
  ): Promise<{ outline: ArticleOutline; usage: AiCallUsage }> {
    const outline: ArticleOutline = {
      title: `${input.topic} — đánh giá chi tiết 2026`,
      sectionHeadings: ["Tiêu chí xếp hạng", "Gợi ý chọn nhanh theo nhu cầu"],
      plannedProducts:
        input.products.length > 0
          ? input.products.map((p) => p.name)
          : ["Sản phẩm mẫu A1", "Sản phẩm mẫu B2"],
      plannedFaqQuestions: [
        "Nên chọn loại nào cho người mới bắt đầu?",
        "Mức giá nào là hợp lý?",
        "Mua ở đâu để có bảo hành tốt?",
      ],
    };
    return { outline, usage: this.zeroUsage() };
  }

  async generateArticle(
    input: GenerateArticleInput,
  ): Promise<{ article: Article; usage: AiCallUsage }> {
    const products =
      input.products.length > 0
        ? input.products
        : [
            { name: "Sản phẩm mẫu A1", url: "https://example.com/a1", price: "890.000d", description: null },
            { name: "Sản phẩm mẫu B2", url: "https://example.com/b2", price: "690.000d", description: null },
          ];

    const filler =
      "Nội dung này được sinh bởi stub provider để test pipeline. " +
      "Khi chạy với provider thật, đoạn này sẽ là nội dung do AI viết dựa trên dữ liệu sản phẩm.";

    const article: Article = {
      hero: {
        title: input.outline.title,
        subtitle: `Tổng hợp đánh giá cho chủ đề: ${input.topic}.`,
        affiliateDisclosure:
          "Bài viết có chứa liên kết tiếp thị liên kết. Khi bạn mua qua liên kết, chúng tôi có thể nhận hoa hồng mà không làm tăng giá của bạn.",
      },
      intent: {
        forWho: `Dành cho người đang tìm hiểu về ${input.topic}.`,
        problem: "Khó chọn sản phẩm phù hợp trong tầm giá khi mua online.",
      },
      quickAnswer: {
        bullets: [
          "Ưu tiên sản phẩm có thông tin chất liệu rõ ràng.",
          "So sánh giá giữa các nhà cung cấp trước khi mua.",
          "Đọc kỹ chính sách đổi trả và bảo hành.",
        ],
      },
      sections: input.outline.sectionHeadings.map((heading) => ({
        heading,
        content: `${heading}: ${filler}`,
      })),
      productRecommendations: products.map((p) => ({
        name: p.name,
        whyInList: "Được chọn dựa trên dữ liệu sản phẩm có sẵn trong hệ thống.",
        pros: ["Thông tin rõ ràng", "Giá hợp lý"],
        cons: ["Cần kiểm tra tồn kho trước khi đặt"],
        priceRange: p.price ?? "Liên hệ",
        bestFor: "Người mua lần đầu trong tầm giá phổ thông",
        productUrl: p.url,
      })),
      faq: input.outline.plannedFaqQuestions.slice(0, 6).map((question) => ({
        question,
        answer: `Trả lời mẫu (stub): ${filler}`,
      })),
      finalCta: {
        text: "Xem giá mới nhất trước khi chốt mua để chọn đúng phiên bản bạn thích.",
        action: "Xem sản phẩm gợi ý",
      },
      metadata: {
        metaTitle: input.outline.title.slice(0, 70),
        metaDescription: `Đánh giá và gợi ý lựa chọn cho ${input.topic}.`.slice(0, 170),
        slug: this.toSlug(input.outline.title),
        internalLinkSuggestions: ["/bai-viet-lien-quan-1", "/bai-viet-lien-quan-2"],
      },
    };

    // Tu kiem tra output truoc khi tra ve — moi provider deu phai dam bao dieu nay
    return { article: articleSchema.parse(article), usage: this.zeroUsage() };
  }

  private zeroUsage(): AiCallUsage {
    return { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 };
  }

  private toSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // bo dau tieng Viet
      .replace(/dđ/g, "d")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }
}
