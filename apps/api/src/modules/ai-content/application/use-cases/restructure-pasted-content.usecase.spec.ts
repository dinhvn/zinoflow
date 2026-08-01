import { RestructurePastedContentUseCase } from "./restructure-pasted-content.usecase";
import type {
  AiCallUsage,
  AiProviderRegistry,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../ports/content-ai-provider.port";
import type { AiUsageEntry, AiUsageRecorder } from "../ports/ai-usage-recorder.port";

const usage: AiCallUsage = { inputTokens: 10, outputTokens: 20, costUsd: 0.001, latencyMs: 5 };

/** Fake provider: tra ve dung "output" duoc cau hinh, khong quan tam prompt. */
function fakeProvider(output: unknown): ContentAiProvider {
  return {
    key: "anthropic",
    isConfigured: () => true,
    supportsBatch: false,
    generateStructured: async (_request: StructuredGenerationRequest, schema) => ({
      output: schema.parse(output),
      usage,
    }),
  };
}

function fakeRegistry(provider: ContentAiProvider): AiProviderRegistry {
  return { resolve: () => provider };
}

function fakeRecorder(): { recorder: AiUsageRecorder; entries: AiUsageEntry[] } {
  const entries: AiUsageEntry[] = [];
  return { recorder: { record: async (e) => void entries.push(e) }, entries };
}

describe("RestructurePastedContentUseCase (redesign luong viet bai §Phase 2)", () => {
  it("tach AI day du -> tra ve DestinationArticle hop le voi dung du lieu AI cung cap", async () => {
    const aiOutput = {
      title: "Đà Lạt: kinh nghiệm du lịch đầy đủ 2026",
      intro:
        "Đà Lạt là thành phố ngàn hoa của Lâm Đồng, khí hậu mát mẻ quanh năm, rất thích hợp " +
        "cho các chuyến đi nghỉ dưỡng cuối tuần hoặc kỳ nghỉ dài ngày cùng gia đình bạn bè.",
      quickFacts: {
        openingTime: "Tham quan tự do",
        ticketPrice: "Tuỳ điểm (có thể thay đổi)",
        transport: "Xe khách hoặc máy bay tới Liên Khương.",
        food: "Bánh tráng nướng, lẩu gà lá é.",
        hotel: "Khu Hoà Bình nhiều homestay.",
        tip: "Mang áo ấm buổi tối.",
      },
      sections: [
        { blockKey: "tong-quan", heading: "Tổng quan", content: "Đà Lạt nổi tiếng với khí hậu mát mẻ quanh năm và rất nhiều vườn hoa đẹp." },
        { blockKey: "mua-nao", heading: "Mùa nào đẹp", content: "Mùa khô từ tháng 12 đến tháng 3 là đẹp nhất, trời trong xanh và ít mưa." },
        { blockKey: "di-chuyen", heading: "Di chuyển", content: "Đi xe khách giường nằm hoặc bay tới sân bay Liên Khương rồi taxi vào trung tâm." },
        {
          blockKey: "an-gi",
          heading: "Ăn gì",
          content: "Một số món đặc trưng.",
          items: [
            { ten: "Bánh tráng nướng", moTa: "Món ăn vặt nổi tiếng khắp các con phố." },
            { ten: "Lẩu gà lá é", moTa: "Đặc sản vùng cao nguyên, ăn kèm rau rừng." },
            { ten: "Sữa đậu nành nóng", moTa: "Uống buổi tối se lạnh rất hợp." },
          ],
        },
      ],
      faq: [
        { question: "Nên đi mấy ngày?", answer: "2-3 ngày là hợp lý." },
        { question: "Đi mùa nào đẹp?", answer: "Mùa khô tháng 12-3." },
        { question: "Chi phí khoảng bao nhiêu?", answer: "Khoảng 2-3 triệu/người." },
      ],
      metadata: {
        name: "Đà Lạt",
        metaTitle: "Đà Lạt: kinh nghiệm du lịch đầy đủ 2026",
        metaDescription:
          "Kinh nghiệm du lịch Đà Lạt: đi mùa nào, di chuyển, ăn gì, ở đâu — tổng hợp chi tiết cho bạn.",
        description: "Đà Lạt là thành phố ngàn hoa nổi tiếng của Lâm Đồng, khí hậu mát mẻ quanh năm.",
        searchKeyword: "đà lạt, du lịch đà lạt",
      },
    };

    const { recorder, entries } = fakeRecorder();
    const usecase = new RestructurePastedContentUseCase(fakeRegistry(fakeProvider(aiOutput)), recorder);

    const result = await usecase.execute({
      rawText: "Bài viết mẫu dài đủ 50 ký tự để qua validate request.",
      topic: "Đà Lạt",
      keywordSeed: [],
    });

    expect(result.metadata.name).toBe("Đà Lạt");
    expect(result.sections).toHaveLength(7); // du 7 blockKey co dinh, ke ca khoi AI khong tra ve
    expect(result.sections.find((s) => s.blockKey === "an-gi")?.items).toHaveLength(3);
    expect(result.sections.find((s) => s.blockKey === "lich-trinh")?.content).toContain(
      "Cần bổ sung",
    ); // AI khong tra ve khoi nay -> danh dau ro, khong bia
    expect(entries).toHaveLength(1);
    expect(entries[0]?.operation).toBe("restructure-paste");
  });

  it("AI tra ve thieu hau het field -> van tao duoc DestinationArticle hop le voi placeholder ro rang", async () => {
    const minimalOutput = { sections: [] };
    const usecase = new RestructurePastedContentUseCase(
      fakeRegistry(fakeProvider(minimalOutput)),
      fakeRecorder().recorder,
    );

    const result = await usecase.execute({
      rawText: "Bài viết mẫu dài đủ 50 ký tự để qua validate request.",
      topic: "Điểm đến mới",
      keywordSeed: ["điểm đến mới"],
    });

    expect(result.sections).toHaveLength(7);
    expect(result.metadata.name).toBe("Điểm đến mới");
    expect(result.title).toContain("Điểm đến mới");
  });
});
