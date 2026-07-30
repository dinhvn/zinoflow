import { DismissQualityWarningUseCase } from "./dismiss-quality-warning.usecase";
import type {
  QualityWarningFeedbackRecord,
  QualityWarningFeedbackRepository,
} from "../ports/quality-warning-feedback.repository";

describe("DismissQualityWarningUseCase", () => {
  it("ghi target, reason va hash detail ma khong sua gate result", async () => {
    const records: QualityWarningFeedbackRecord[] = [];
    const repository: QualityWarningFeedbackRepository = {
      create: async (record) => void records.push(record),
    };
    const result = await new DismissQualityWarningUseCase(repository).execute({
      targetType: "destination",
      targetId: "thac-trieu-hai",
      gateName: "style",
      detail: "Cụm văn mẫu cần xem lại",
      reason: "Ngữ cảnh này là tên chiến dịch đã duyệt",
    });

    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(records).toHaveLength(1);
    expect(records[0]?.reason).toBe("Ngữ cảnh này là tên chiến dịch đã duyệt");
    expect(records[0]?.detailHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
