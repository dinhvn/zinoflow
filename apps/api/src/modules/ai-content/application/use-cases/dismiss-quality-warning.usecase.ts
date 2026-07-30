import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import type {
  DismissQualityWarningRequest,
  DismissQualityWarningResponse,
} from "@zinoflow/contracts";
import {
  QUALITY_WARNING_FEEDBACK_REPOSITORY,
  type QualityWarningFeedbackRepository,
} from "../ports/quality-warning-feedback.repository";

/** Ghi ly do reviewer chap nhan/dismiss warning de do false positive; khong doi gate result. */
@Injectable()
export class DismissQualityWarningUseCase {
  constructor(
    @Inject(QUALITY_WARNING_FEEDBACK_REPOSITORY)
    private readonly repository: QualityWarningFeedbackRepository,
  ) {}

  async execute(
    request: DismissQualityWarningRequest,
  ): Promise<DismissQualityWarningResponse> {
    const id = randomUUID();
    const createdAt = new Date();
    await this.repository.create({
      id,
      targetType: request.targetType,
      targetId: request.targetId,
      gateName: request.gateName,
      detailHash: createHash("sha256")
        .update(request.detail.trim())
        .digest("hex"),
      reason: request.reason.trim(),
      createdAt,
    });
    return { id, createdAt: createdAt.toISOString() };
  }
}
