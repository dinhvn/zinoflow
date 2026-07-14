import { Inject, Injectable } from "@nestjs/common";
import { z } from "zod/v4";
import {
  aiProviderKeySchema,
  DESTINATION_BLOCK_LABELS,
  DESTINATION_LIST_BLOCK_KEYS,
  DESTINATION_SECTION_ORDER,
  destinationArticleSchema,
  destinationBlockKeySchema,
  faqItemSchema,
  MIN_LIST_ITEMS,
  structuredListItemSchema,
  type DestinationArticle,
  type RestructurePastedContentRequest,
} from "@zinoflow/contracts";
import { AI_PROVIDER_REGISTRY, type AiProviderRegistry } from "../ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../ports/ai-usage-recorder.port";
import { slugifyVietnamese } from "../../../shared/text/vietnamese";

/** Tac vu tach lai text co san — nhe, dung Haiku (coding rules §5). */
const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-haiku-4-5";

/** Danh dau ro rang phan AI khong trich xuat duoc tu bai dan — nguoi dung tu bo sung, KHONG bia. */
const MISSING_MARK = "[Cần bổ sung — chưa trích xuất được từ bài dán]";

const SYSTEM = [
  "Bạn là biên tập viên du lịch Việt Nam.",
  "Luôn trả lời bằng tiếng Việt có dấu đầy đủ.",
  "Nhiệm vụ CHỈ LÀ TÁCH LẠI nội dung người dùng cung cấp vào đúng cấu trúc yêu cầu —",
  "TUYỆT ĐỐI KHÔNG viết mới, KHÔNG bịa thêm số liệu/chi tiết không có trong văn bản gốc.",
  "Phần nào văn bản gốc không có thông tin thì bỏ trống field đó, không tự suy diễn.",
].join(" ");

/** Output AI — noi long hon destinationArticleSchema vi day chi la ban trich xuat tho. */
const looseSectionSchema = z.object({
  blockKey: destinationBlockKeySchema,
  heading: z.string().optional(),
  content: z.string().optional(),
  items: z.array(structuredListItemSchema).optional(),
});

const looseRestructureSchema = z.object({
  title: z.string().optional(),
  intro: z.string().optional(),
  quickFacts: z
    .object({
      openingTime: z.string().optional(),
      ticketPrice: z.string().optional(),
      transport: z.string().optional(),
      food: z.string().optional(),
      hotel: z.string().optional(),
      tip: z.string().optional(),
    })
    .optional(),
  sections: z.array(looseSectionSchema),
  faq: z.array(faqItemSchema).optional(),
  updateNotice: z.string().optional(),
  metadata: z
    .object({
      name: z.string().optional(),
      metaTitle: z.string().optional(),
      metaDescription: z.string().optional(),
      description: z.string().optional(),
      searchKeyword: z.string().optional(),
    })
    .optional(),
});
type LooseRestructure = z.infer<typeof looseRestructureSchema>;

/**
 * AI tach 1 bai viet CO SAN (dan tu ChatGPT/Gemini khac, hoac ban nhap tu viet chua
 * dung cau truc) vao dung 6 khoi co dinh cua bai diem den — redesign luong viet bai
 * §Phase 2. Chi TACH, khong sang tac; phan AI khong trich xuat duoc danh dau ro bang
 * MISSING_MARK de nguoi dung tu bo sung tren editor field-based, KHONG bia du lieu.
 * Ket qua tra ve DA la DestinationArticle hop le (qua schema.parse) de FE do thang
 * vao editor va PUT draft (UpdateDraftUseCase nhanh `article`) ma khong can xu ly them.
 */
@Injectable()
export class RestructurePastedContentUseCase {
  constructor(
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(request: RestructurePastedContentRequest): Promise<DestinationArticle> {
    const providerKey = aiProviderKeySchema.parse(request.aiProvider ?? DEFAULT_PROVIDER);
    const model = request.aiModel ?? DEFAULT_MODEL;
    const provider = this.registry.resolve(providerKey);

    const blockList = DESTINATION_SECTION_ORDER.map(
      (key) => `- "${key}": ${DESTINATION_BLOCK_LABELS[key]}`,
    ).join("\n");

    const prompt = [
      `Điểm đến: "${request.topic}".`,
      "Đây là bài viết CÓ SẴN (có thể copy từ AI khác hoặc tự viết), cần tách lại vào cấu trúc chuẩn:",
      "---",
      request.rawText,
      "---",
      "Tách nội dung trên vào ĐÚNG các blockKey cố định sau (bỏ qua khối nào văn bản gốc",
      "không có thông tin liên quan, KHÔNG tự bịa thêm để lấp đầy):",
      blockList,
      'Với blockKey "an-gi" hoặc "qua-mang-ve": nếu văn bản gốc liệt kê món ăn/đặc sản cụ thể,',
      "tách vào \"items\" (mỗi mục {ten, moTa}); không có thông tin thì bỏ trống.",
      "Cũng trích xuất thêm (nếu văn bản gốc có): title, intro, quickFacts",
      "(openingTime/ticketPrice/transport/food/hotel/tip), faq, updateNotice, metadata",
      "(name/metaTitle/metaDescription/description/searchKeyword).",
    ].join("\n");

    const { output, usage } = await provider.generateStructured(
      {
        model,
        operation: "restructure-paste",
        system: SYSTEM,
        prompt,
        maxTokens: 4_000,
        vars: { topic: request.topic, articleType: "guide-diem-den" },
      },
      looseRestructureSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model,
      operation: "restructure-paste",
      ...usage,
    });

    return assembleDestinationArticle(request.topic, request.keywordSeed, output);
  }
}

/** Bu placeholder ro rang cho phan AI khong trich xuat duoc, roi validate qua schema day du. */
function assembleDestinationArticle(
  topic: string,
  keywordSeed: readonly string[],
  loose: LooseRestructure,
): DestinationArticle {
  const sections = DESTINATION_SECTION_ORDER.map((blockKey) => {
    const found = loose.sections.find((s) => s.blockKey === blockKey);
    const heading = found?.heading?.trim() || DESTINATION_BLOCK_LABELS[blockKey];

    if (DESTINATION_LIST_BLOCK_KEYS.includes(blockKey)) {
      const items = Array.from({ length: Math.max(MIN_LIST_ITEMS, found?.items?.length ?? 0) }, (_, i) =>
        found?.items?.[i] ?? { ten: MISSING_MARK, moTa: MISSING_MARK },
      );
      return { heading, content: padToMinLength(found?.content?.trim(), 55), blockKey, items };
    }
    return { heading, content: padToMinLength(found?.content?.trim(), 60), blockKey };
  });

  return destinationArticleSchema.parse({
    title: (loose.title?.trim() || topic).padEnd(10, "."),
    intro: padToMinLength(loose.intro?.trim(), 80),
    quickFacts: {
      openingTime: loose.quickFacts?.openingTime?.trim() || "Cần kiểm tra lại",
      ticketPrice: loose.quickFacts?.ticketPrice?.trim() || "Cần kiểm tra lại (có thể thay đổi)",
      transport: loose.quickFacts?.transport?.trim() || MISSING_MARK,
      food: loose.quickFacts?.food?.trim() || MISSING_MARK,
      hotel: loose.quickFacts?.hotel?.trim() || MISSING_MARK,
      tip: loose.quickFacts?.tip?.trim() || MISSING_MARK,
    },
    faq: padFaq(loose.faq ?? []),
    updateNotice:
      loose.updateNotice?.trim() ||
      `Thông tin trong bài cập nhật tháng ${currentMonthYear()}, giá vé và giờ mở cửa có thể thay đổi.`,
    metadata: {
      name: loose.metadata?.name?.trim() || topic,
      slugSuggestion: slugifyVietnamese(topic) || "diem-den",
      metaTitle: (loose.metadata?.metaTitle?.trim() || topic).slice(0, 140).padEnd(10, "."),
      metaDescription: padToMinLength(loose.metadata?.metaDescription?.trim(), 50),
      description: padToMinLength(loose.metadata?.description?.trim(), 50),
      searchKeyword: loose.metadata?.searchKeyword?.trim() || keywordSeed.join(", ") || topic,
    },
    sections,
  });
}

/** Dam bao du do dai toi thieu cho field text — bo sung MISSING_MARK thay vi bia noi dung. */
function padToMinLength(text: string | undefined, minLen: number): string {
  const value = text || MISSING_MARK;
  return value.length >= minLen ? value : `${value} ${MISSING_MARK}`.padEnd(minLen, ".");
}

/** FAQ toi thieu 3 cau — thieu thi bu cau hoi placeholder de qua schema, nguoi dung tu dien. */
function padFaq(faq: { question: string; answer: string }[]): { question: string; answer: string }[] {
  const filled = [...faq];
  while (filled.length < MIN_LIST_ITEMS) {
    filled.push({ question: MISSING_MARK, answer: MISSING_MARK });
  }
  return filled;
}

function currentMonthYear(): string {
  const now = new Date();
  return `${now.getMonth() + 1}/${now.getFullYear()}`;
}
