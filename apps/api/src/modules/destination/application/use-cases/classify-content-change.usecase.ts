import { Injectable, Inject } from "@nestjs/common";
import { classifyContentChangeResponseSchema, type ClassifyContentChangeResponse } from "@zinoflow/contracts";
import {
  AI_PROVIDER_REGISTRY,
  type AiProviderRegistry,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import { AI_USAGE_RECORDER, type AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";
import { buildPromptLogText } from "../../../ai-content/application/services/prompt-log-text";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-haiku-4-5"; // tac vu nhe -> Haiku (spec §5)

const SYSTEM = [
  "Bạn là biên tập viên SEO, đánh giá 1 lần sửa nội dung bài viết du lịch.",
  "Nhiệm vụ DUY NHẤT: phân loại thay đổi giữa 2 bản HTML là THAY ĐỔI THÔNG TIN THỰC SỰ",
  "(số liệu, sự kiện, khuyến nghị, thông tin mới/khác trước) hay CHỈ sửa câu chữ/chính",
  "tả/định dạng (không đổi giá trị thông tin cho người đọc).",
  "Trả lời NGẮN GỌN bằng tiếng Việt có dấu đầy đủ.",
].join(" ");

/**
 * Content-freshness-plan.md Giai doan C — chi goi khi bien tap vien sua tay
 * ContentHtml cua bai DA publish (KHONG phai luc publish lan dau, va KHONG can
 * cho field so lieu da co gate tu dong o has-meaningful-field-change.ts).
 * Ket qua dung de quyet dinh co bump ContentUpdatedAt hay khong — co 1 nut
 * override thu cong o UI neu bien tap vien khong dong y ket qua AI.
 */
@Injectable()
export class ClassifyContentChangeUseCase {
  constructor(
    @Inject(AI_PROVIDER_REGISTRY) private readonly registry: AiProviderRegistry,
    @Inject(AI_USAGE_RECORDER) private readonly usage: AiUsageRecorder,
  ) {}

  async execute(input: {
    destinationName: string;
    oldContentHtml: string;
    newContentHtml: string;
  }): Promise<ClassifyContentChangeResponse> {
    const prompt = [
      `Điểm đến: ${input.destinationName}`,
      "",
      "BẢN CŨ (đang publish):",
      stripHtml(input.oldContentHtml),
      "",
      "BẢN MỚI (sắp publish):",
      stripHtml(input.newContentHtml),
      "",
      "So sánh 2 bản trên. Đây có phải thay đổi thông tin/nội dung thực sự",
      "(thêm/sửa số liệu, sự kiện, khuyến nghị, thông tin mới) hay chỉ là sửa",
      "câu chữ/chính tả/cách diễn đạt/định dạng mà KHÔNG đổi giá trị thông tin?",
    ].join("\n");

    const provider = this.registry.resolve(DEFAULT_PROVIDER);
    const { output, usage } = await provider.generateStructured(
      {
        model: DEFAULT_MODEL,
        operation: "classify-content-change",
        system: SYSTEM,
        prompt,
        maxTokens: 300,
        vars: { topic: input.destinationName, articleType: "guide-diem-den-classify-change" },
      },
      classifyContentChangeResponseSchema,
    );

    await this.usage.record({
      jobId: null,
      provider: provider.key,
      model: DEFAULT_MODEL,
      operation: "classify-content-change",
      ...usage,
      promptText: buildPromptLogText(SYSTEM, prompt, classifyContentChangeResponseSchema),
      responseText: JSON.stringify(output),
    });
    return output;
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
