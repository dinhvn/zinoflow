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
      title: `${input.topic} — danh gia chi tiet 2026`,
      sectionHeadings: ["Tieu chi xep hang", "Goi y chon nhanh theo nhu cau"],
      plannedProducts:
        input.products.length > 0
          ? input.products.map((p) => p.name)
          : ["San pham mau A1", "San pham mau B2"],
      plannedFaqQuestions: [
        "Nen chon loai nao cho nguoi moi bat dau?",
        "Muc gia nao la hop ly?",
        "Mua o dau de co bao hanh tot?",
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
            { name: "San pham mau A1", url: "https://example.com/a1", price: "890.000d", description: null },
            { name: "San pham mau B2", url: "https://example.com/b2", price: "690.000d", description: null },
          ];

    const filler =
      "Noi dung nay duoc sinh boi stub provider de test pipeline. " +
      "Khi chay voi provider that, doan nay se la noi dung do AI viet dua tren du lieu san pham.";

    const article: Article = {
      hero: {
        title: input.outline.title,
        subtitle: `Tong hop danh gia cho chu de: ${input.topic}.`,
        affiliateDisclosure:
          "Bai viet co chua lien ket tiep thi lien ket. Khi ban mua qua lien ket, chung toi co the nhan hoa hong ma khong lam tang gia cua ban.",
      },
      intent: {
        forWho: `Danh cho nguoi dang tim hieu ve ${input.topic}.`,
        problem: "Kho chon san pham phu hop trong tam gia khi mua online.",
      },
      quickAnswer: {
        bullets: [
          "Uu tien san pham co thong tin chat lieu ro rang.",
          "So sanh gia giua cac nha cung cap truoc khi mua.",
          "Doc ky chinh sach doi tra va bao hanh.",
        ],
      },
      sections: input.outline.sectionHeadings.map((heading) => ({
        heading,
        content: `${heading}: ${filler}`,
      })),
      productRecommendations: products.map((p) => ({
        name: p.name,
        whyInList: "Duoc chon dua tren du lieu san pham co san trong he thong.",
        pros: ["Thong tin ro rang", "Gia hop ly"],
        cons: ["Can kiem tra ton kho truoc khi dat"],
        priceRange: p.price ?? "Lien he",
        bestFor: "Nguoi mua lan dau trong tam gia pho thong",
        productUrl: p.url,
      })),
      faq: input.outline.plannedFaqQuestions.slice(0, 6).map((question) => ({
        question,
        answer: `Tra loi mau (stub): ${filler}`,
      })),
      finalCta: {
        text: "Xem gia moi nhat truoc khi chot mua de chon dung phien ban ban thich.",
        action: "Xem san pham goi y",
      },
      metadata: {
        metaTitle: input.outline.title.slice(0, 70),
        metaDescription: `Danh gia va goi y lua chon cho ${input.topic}.`.slice(0, 170),
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
