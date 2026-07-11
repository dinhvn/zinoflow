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
    const isDestination = request.vars["articleType"] === "guide-diem-den";
    switch (request.operation) {
      case "suggest-meta":
        return this.buildMetaSuggestion(request.vars);
      case "suggest-editorial-review":
        return this.buildEditorialReviewSuggestion(request.vars);
      case "outline":
        return isDestination
          ? this.buildDestinationOutline(request.vars)
          : this.buildOutline(request.vars);
      case "section":
        return this.buildSection(request.vars);
      case "frame":
        return isDestination
          ? this.buildDestinationFrame(request.vars)
          : this.buildFrame(request.vars);
      default:
        throw new AiProviderError(`Stub provider: unknown operation "${request.operation}"`);
    }
  }

  /** Goi y metadata "mem" cho diem den (suggest-meta) — output deterministic. */
  private buildMetaSuggestion(vars: Readonly<Record<string, unknown>>): unknown {
    const topic = String(vars["topic"] ?? "điểm đến");
    return {
      shortDescription: `${topic} là một điểm đến đáng chú ý, phù hợp cho chuyến đi khám phá thiên nhiên và văn hoá địa phương.`,
      suggestedKind: "poi",
      searchKeyword: `${topic}, du lịch ${topic}, kinh nghiệm ${topic}`.toLowerCase().slice(0, 250),
    };
  }

  /** Goi y "danh gia bien tap" (suggest-editorial-review, Phase 28.0) — output deterministic. */
  private buildEditorialReviewSuggestion(vars: Readonly<Record<string, unknown>>): unknown {
    const topic = String(vars["topic"] ?? "điểm đến");
    return {
      suggestion: `${topic} là điểm đến đáng ghé qua với đặc trưng riêng — stub provider sinh câu trả lời mẫu, provider thật sẽ dựa trên nội dung thực tế đã có.`,
    };
  }

  /** Outline bai diem den (guide-diem-den) — >=3 heading theo destinationOutlineSchema. */
  private buildDestinationOutline(vars: Readonly<Record<string, unknown>>): unknown {
    const topic = String(vars["topic"] ?? "điểm đến thử nghiệm");
    return {
      title: `${topic}: kinh nghiệm tham quan, giá vé, ăn gì 2026`,
      sectionHeadings: [
        "Giới thiệu tổng quan",
        `Chơi gì ở ${topic}`,
        "Thời điểm đẹp nhất để đi",
        "Món ăn và đặc sản gần đó",
      ],
      plannedFaqQuestions: [
        `Đi ${topic} mùa nào đẹp nhất?`,
        "Tham quan mất bao lâu?",
        "Có cần mua vé trước không?",
      ],
    };
  }

  /** Frame bai diem den — theo destinationArticleFrameSchema. */
  private buildDestinationFrame(vars: Readonly<Record<string, unknown>>): unknown {
    const topic = String(vars["topic"] ?? "điểm đến thử nghiệm");
    const title = String(vars["title"] ?? `${topic}: kinh nghiệm tham quan, giá vé, ăn gì 2026`);
    return {
      title,
      intro:
        `${topic} là một trong những điểm dừng chân được nhiều du khách quan tâm khi lên lịch trình. ` +
        "Bài viết này do stub provider sinh ra để kiểm tra pipeline; khi chạy provider thật, " +
        "phần mở bài sẽ được AI viết dựa trên dữ liệu điểm đến được cung cấp, nêu cả địa chỉ mới " +
        "và địa chỉ cũ trước sáp nhập nếu dữ liệu có đủ thông tin cho cả hai trường này.",
      quickFacts: {
        openingTime: "Cần kiểm tra lại",
        ticketPrice: "Cần kiểm tra lại (có thể thay đổi)",
        transport: "Stub: cách di chuyển sẽ do AI viết từ dữ liệu điểm đến.",
        food: "Stub: gợi ý ăn uống sẽ do AI viết từ dữ liệu điểm đến.",
        hotel: "Stub: gợi ý khu lưu trú sẽ do AI viết từ dữ liệu điểm đến.",
        tip: "Stub: mẹo tham quan sẽ do AI viết từ dữ liệu điểm đến.",
      },
      faq: [
        `Đi ${topic} mùa nào đẹp nhất?`,
        "Tham quan mất bao lâu?",
        "Có cần mua vé trước không?",
      ].map((question) => ({
        question,
        answer: "Trả lời mẫu (stub): provider thật sẽ trả lời theo dữ liệu điểm đến.",
      })),
      updateNotice:
        `Thông tin trong bài cập nhật tháng ${new Date().getMonth() + 1}/${new Date().getFullYear()}, ` +
        "giá vé và giờ mở cửa có thể thay đổi.",
      metadata: {
        name: topic,
        slugSuggestion: this.toSlug(topic),
        metaTitle: title.slice(0, 140),
        metaDescription:
          `Kinh nghiệm tham quan ${topic}: giá vé, thời điểm đẹp, ăn gì, ở đâu — tổng hợp cho chuyến đi đầu tiên của bạn.`.slice(
            0,
            290,
          ),
        description:
          `${topic} là điểm đến đáng chú ý trong khu vực, phù hợp cho cả chuyến đi ngắn lẫn lịch trình dài ngày.`,
        searchKeyword: `${topic}, du lịch ${topic}, kinh nghiệm ${topic}`.toLowerCase().slice(0, 250),
      },
    };
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
    // Du 60+ tu de qua gate structure — cho phep test tron flow approve/publish
    // bang stub ma khong ton tien provider that.
    return {
      heading,
      content:
        `${heading}: Nội dung này được sinh bởi stub provider để kiểm tra trọn vẹn pipeline ` +
        "từ lúc tạo bài cho đến khi duyệt và xuất bản mà không gọi API thật, không tốn chi phí. " +
        "Khi chạy với provider thật, đoạn này sẽ là nội dung do AI viết dựa trên dữ liệu nguồn " +
        "được cung cấp trong ngữ cảnh của job, bám sát giọng văn đã cấu hình cho từng site. " +
        "Đoạn văn mẫu này được cố ý viết đủ dài và bằng tiếng Việt có dấu đầy đủ để vượt qua " +
        "ngưỡng kiểm tra độ dài tối thiểu của từng phần trong cổng chất lượng cấu trúc bài viết.",
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
