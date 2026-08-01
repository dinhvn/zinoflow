import type { AiProviderKey } from "@zinoflow/contracts";
import type { ZodType } from "zod/v4";
import type { AiCallUsage, StructuredGenerationRequest } from "./content-ai-provider.port";

/**
 * Handler cho 1 loai tac vu chay duoc qua Batch AI (Gemini Batch API).
 * Them 1 loai tac vu moi = viet 1 handler moi tu dang ky vao registry qua
 * onModuleInit() cua chinh module so huu no — KHONG sua core (SubmitAiBatchUseCase/
 * CheckAiBatchUseCase khong biet gi ve noi dung cu the tung tac vu).
 *
 * entityId: id cua doi tuong duoc xu ly, y nghia tuy taskType (contentJobId |
 * destination slug | cluster slug...). params: du lieu phu tuy chon (vd
 * cluster-poi-discovery doc params.extraNotes) — handler nao khong can thi bo qua.
 */
export interface BatchTaskHandler {
  readonly taskType: string;

  /**
   * Build request AI cho 1 item — goi luc submit batch. providerKey de
   * SubmitAiBatchUseCase resolve dung provider (vd content-outline/content-article
   * mac dinh doc theo job.aiProvider tung job; destination-gsg-extraction/cluster-poi-discovery
   * mac dinh luon "gemini", giong usecase don le hien tai). Tat ca item trong
   * CUNG 1 batch phai tra ve CUNG 1 providerKey — SubmitAiBatchUseCase tu choi neu lan.
   *
   * override: nguoi dung chon provider/model rieng cho CA batch nay (trang
   * /ai-batches) — GHI DE gia tri mac dinh cua item, KHONG doi field aiProvider/
   * aiModel luu tren job. Handler khong ho tro doi provider (vd destination-gsg-extraction
   * chi chay duoc Gemini vi can useGoogleSearch) thi bo qua override.provider,
   * chi ap dung override.model.
   */
  buildRequest(
    entityId: string,
    params?: Record<string, unknown>,
    override?: { provider: AiProviderKey; model: string },
  ): Promise<{ request: StructuredGenerationRequest; schema: ZodType; providerKey: AiProviderKey }>;

  /**
   * Hook tuy chon — goi SAU KHI provider.submitBatch() thanh cong that (khong
   * goi truoc, tranh doi trang thai roi submit lai that bai). Dung cho tac vu
   * can danh dau "da gui di" (vd content-outline chuyen job Created ->
   * GeneratingOutline) — tac vu khong can thi bo qua (khong implement).
   */
  onSubmitted?(entityId: string): Promise<void>;

  /**
   * Ap ket qua thanh cong vao he thong (luu DB, doi trang thai...) — goi luc
   * bam "Kiem tra" va Google da tra JOB_STATE_SUCCEEDED cho item nay. Nem loi
   * neu rawOutput khong hop le (schema) — CheckAiBatchUseCase se bat va coi
   * item nay la failed, KHONG lam hong ca batch.
   *
   * batchContext: provider/model THAT SU da dung cho ca batch (doc tu
   * AiBatch.provider/model — da phan anh dung override neu co luc submit) —
   * dung de ghi ai_usage_logs cho dung, KHONG suy tu job/hang-code nua.
   */
  applyResult(
    entityId: string,
    rawOutput: unknown,
    usage: AiCallUsage,
    batchContext: { provider: AiProviderKey; model: string },
  ): Promise<void>;

  /** Ap loi (Google tra error cho item nay, hoac applyResult nem loi) — vd doi status job sang Failed. */
  applyError(entityId: string, errorMessage: string): Promise<void>;
}

export const BATCH_TASK_HANDLER_REGISTRY = Symbol("BATCH_TASK_HANDLER_REGISTRY");

export interface BatchTaskHandlerRegistry {
  /** Moi handler tu goi trong onModuleInit() cua chinh no — xem ai-content.module.ts. */
  register(handler: BatchTaskHandler): void;
  /** Nem DomainRuleError neu taskType chua co handler nao dang ky. */
  resolve(taskType: string): BatchTaskHandler;
}
