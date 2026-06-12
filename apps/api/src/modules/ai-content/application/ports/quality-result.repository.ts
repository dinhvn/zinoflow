import type { QualityCheck } from "@zinoflow/contracts";

/**
 * Port luu ket qua quality gates (bang content_quality_results).
 * Moi lan chay checks ghi de ket qua cu cua draft do — chi ket qua MOI NHAT
 * co y nghia cho viec chan/cho Approve.
 */
export const QUALITY_RESULT_REPOSITORY = Symbol("QUALITY_RESULT_REPOSITORY");

export interface QualityResultRepository {
  replaceForDraft(draftId: string, checks: readonly QualityCheck[]): Promise<void>;
  findByDraftId(draftId: string): Promise<QualityCheck[]>;
}
