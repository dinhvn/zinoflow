import type { ZodType, z } from "zod/v4";
import { ClassifyContentChangeUseCase } from "./classify-content-change.usecase";
import type {
  AiCallUsage,
  AiProviderRegistry,
  ContentAiProvider,
  StructuredGenerationRequest,
} from "../../../ai-content/application/ports/content-ai-provider.port";
import type { AiUsageRecorder } from "../../../ai-content/application/ports/ai-usage-recorder.port";

function fakeProvider(output: unknown): ContentAiProvider {
  return {
    key: "anthropic",
    isConfigured: () => true,
    supportsBatch: false,
    generateStructured: async <TSchema extends ZodType>(
      _request: StructuredGenerationRequest,
      _schema: TSchema,
    ): Promise<{ output: z.infer<TSchema>; usage: AiCallUsage }> => ({
      output: output as z.infer<TSchema>,
      usage: { inputTokens: 5, outputTokens: 5, costUsd: 0, latencyMs: 1 },
    }),
  };
}

describe("ClassifyContentChangeUseCase (content-freshness-plan.md Giai doan C)", () => {
  it("tra ve isMeaningful=true khi AI xac nhan doi noi dung that, ghi usage dung operation", async () => {
    const usageRecords: string[] = [];
    const usecase = new ClassifyContentChangeUseCase(
      { resolve: () => fakeProvider({ isMeaningful: true, reason: "Đổi giá vé" }) } as AiProviderRegistry,
      { record: async (e) => void usageRecords.push(e.operation) } as AiUsageRecorder,
    );

    const result = await usecase.execute({
      destinationName: "Thác Triệu Hải",
      oldContentHtml: "<p>Giá vé 20.000đ</p>",
      newContentHtml: "<p>Giá vé 25.000đ</p>",
    });

    expect(result).toEqual({ isMeaningful: true, reason: "Đổi giá vé" });
    expect(usageRecords).toEqual(["classify-content-change"]);
  });

  it("tra ve isMeaningful=false khi AI xac nhan chi sua cau chu", async () => {
    const usecase = new ClassifyContentChangeUseCase(
      { resolve: () => fakeProvider({ isMeaningful: false, reason: "Chỉ sửa chính tả" }) } as AiProviderRegistry,
      { record: async () => {} } as AiUsageRecorder,
    );

    const result = await usecase.execute({
      destinationName: "Thác Triệu Hải",
      oldContentHtml: "<p>Nơi này rất đẹp</p>",
      newContentHtml: "<p>Nơi đây rất đẹp</p>",
    });

    expect(result.isMeaningful).toBe(false);
  });
});
