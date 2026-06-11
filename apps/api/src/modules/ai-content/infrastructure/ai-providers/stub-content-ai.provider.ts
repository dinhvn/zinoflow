import { Injectable } from "@nestjs/common";
import type { ArticleFrame, ArticleOutline, ContentSection } from "@zinoflow/contracts";
import type { ZodType, z } from "zod/v4";
import type {
  AiCallUsage,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../../application/ports/content-ai-provider.port";
import type { ProductContext } from "../../application/ports/product-catalog.port";
import { AiProviderError } from "../../../shared/errors/app-error";

/**
 * Stub provider — sinh output deterministic, KHONG goi API that.
 * Dung de: (1) test pipeline khong ton tien, (2) fallback khi provider chua co key.
 * Doc du lieu tu request.vars (topic, sectionHeading...) — provider that khong dung vars.
 * Output luon duoc validate bang chinh schema duoc truyen vao (co test bao ve).
 */
@Injectable()
export class StubContentAiProvider implements ContentAiProvider {
  readonly key = "stub" as const;

  isConfigured(): boolean {
    return true; // stub luon san sang
  }

  async generateStructured<TSchema extends ZodType>(
    request: StructuredGenerationRequest,
    schema: TSchema,
  ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> {
    const raw = this.buildByOperation(request);
    return {
      // Tu kiem tra output truoc khi tra ve — moi provider deu phai dam bao dieu nay
      output: schema.parse(raw) as z.infer<TSchema>,
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0 },
    };
  }

  private buildByOperation(request: StructuredGenerationRequest): unknown {
    switch (request.operation) {
      case "outline":
        return this.buildOutline(request.vars);
      case "section":
        return this.buildSection(request.vars);
      case "frame":
        return this.buildFrame(request.vars);
      default:
        throw new AiProviderError(`Stub provider: unknown operation "${request.operation}"`);
    }
  }

  private buildOutline(vars: Readonly<Record<string, unknown>>): ArticleOutline {
    const topic = String(vars["topic"] ?? "chủ đề thử nghiệm");
    const products = this.productsFrom(vars);
    return {
      title: `${topic} — đánh giá chi tiết 2026`,
      sectionHeadings: ["Tiêu chí xếp hạng", "Cách chọn mua theo ngân sách"],
      plannedProducts:
        products.length > 0 ? products.map((p) => p.name) : ["Sản phẩm mẫu A1", "Sản phẩm mẫu B2"],
      plannedFaqQuestions: [
        "Nên chọn loại nào cho người mới bắt đầu?",
        "Mức giá nào là hợp lý?",
        "Mua ở đâu để có bảo hành tốt?",
      ],
    };
  }

  private buildSection(vars: Readonly<Record<string, unknown>>): ContentSection {
    const heading = String(vars["sectionHeading"] ?? "Nội dung");
    return {
      heading,
      content:
        `${heading}: Nội dung này được sinh bởi stub provider để test pipeline. ` +
        "Khi chạy với provider thật, đoạn này sẽ là nội dung do AI viết dựa trên dữ liệu sản phẩm.",
    };
  }

  private buildFrame(vars: Readonly<Record<string, unknown>>): ArticleFrame {
    const topic = String(vars["topic"] ?? "chủ đề thử nghiệm");
    const title = String(vars["title"] ?? `${topic} — đánh giá chi tiết 2026`);
    const products =
      this.productsFrom(vars).length > 0
        ? this.productsFrom(vars)
        : [
            { name: "Sản phẩm mẫu A1", url: "https://example.com/a1", price: "890.000đ", description: null },
            { name: "Sản phẩm mẫu B2", url: "https://example.com/b2", price: "690.000đ", description: null },
          ];

    return {
      hero: {
        title,
        subtitle: `Tổng hợp đánh giá cho chủ đề: ${topic}.`,
        affiliateDisclosure:
          "Bài viết có chứa liên kết tiếp thị liên kết. Khi bạn mua qua liên kết, chúng tôi có thể nhận hoa hồng mà không làm tăng giá của bạn.",
      },
      intent: {
        forWho: `Dành cho người đang tìm hiểu về ${topic}.`,
        problem: "Khó chọn sản phẩm phù hợp trong tầm giá khi mua online.",
      },
      quickAnswer: {
        bullets: [
          "Ưu tiên sản phẩm có thông tin chất liệu rõ ràng.",
          "So sánh giá giữa các nhà cung cấp trước khi mua.",
          "Đọc kỹ chính sách đổi trả và bảo hành.",
        ],
      },
      productRecommendations: products.map((p) => ({
        name: p.name,
        whyInList: "Được chọn dựa trên dữ liệu sản phẩm có sẵn trong hệ thống.",
        pros: ["Thông tin rõ ràng", "Giá hợp lý"],
        cons: ["Cần kiểm tra tồn kho trước khi đặt"],
        priceRange: p.price ?? "Liên hệ",
        bestFor: "Người mua lần đầu trong tầm giá phổ thông",
        productUrl: p.url,
      })),
      faq: [
        "Nên chọn loại nào cho người mới bắt đầu?",
        "Mức giá nào là hợp lý?",
        "Mua ở đâu để có bảo hành tốt?",
      ].map((question) => ({
        question,
        answer: "Trả lời mẫu (stub): khi chạy provider thật, AI sẽ trả lời dựa trên dữ liệu sản phẩm.",
      })),
      finalCta: {
        text: "Xem giá mới nhất trước khi chốt mua để chọn đúng phiên bản bạn thích.",
        action: "Xem sản phẩm gợi ý",
      },
      metadata: {
        metaTitle: title.slice(0, 70),
        metaDescription: `Đánh giá và gợi ý lựa chọn cho ${topic}.`.slice(0, 170),
        slug: this.toSlug(title),
        internalLinkSuggestions: ["/bai-viet-lien-quan-1", "/bai-viet-lien-quan-2"],
      },
    };
  }

  private productsFrom(vars: Readonly<Record<string, unknown>>): ProductContext[] {
    const products = vars["products"];
    return Array.isArray(products) ? (products as ProductContext[]) : [];
  }

  private toSlug(title: string): string {
    return title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // bo dau tieng Viet
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80);
  }
}
