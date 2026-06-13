import { z } from "zod/v4";

/**
 * Schema cho man quan ly Prompt Template (xem/sua/version).
 * Prompt luu DB co version; doi prompt = tao version moi + active (rollback duoc).
 */

/** Buoc pipeline + system message dung chung */
export const promptOperationSchema = z.enum(["system", "outline", "section", "frame"]);
export type PromptOperation = z.infer<typeof promptOperationSchema>;

/** 1 dong trong man list (gom theo articleType) */
export const promptTemplateSummarySchema = z.object({
  key: z.string(),
  label: z.string(),
  /** null = system prompt (dung chung moi loai bai) */
  articleType: z.string().nullable(),
  operation: promptOperationSchema,
  /** Version active trong DB; null = dang dung noi dung mac dinh (chua co row) */
  activeVersion: z.number().int().nullable(),
  source: z.enum(["db", "default"]),
  updatedAt: z.string().nullable(),
});
export type PromptTemplateSummary = z.infer<typeof promptTemplateSummarySchema>;

export const promptTemplateListResponseSchema = z.object({
  templates: z.array(promptTemplateSummarySchema),
});
export type PromptTemplateListResponse = z.infer<typeof promptTemplateListResponseSchema>;

/** 1 version trong lich su */
export const promptTemplateVersionSchema = z.object({
  version: z.number().int(),
  content: z.string(),
  isActive: z.boolean(),
  createdAt: z.string(),
});
export type PromptTemplateVersion = z.infer<typeof promptTemplateVersionSchema>;

/** Chi tiet 1 template cho editor */
export const promptTemplateDetailSchema = z.object({
  key: z.string(),
  label: z.string(),
  articleType: z.string().nullable(),
  operation: promptOperationSchema,
  /** Bien {{...}} hop le — UI hien chip goi y + canh bao placeholder la */
  variables: z.array(z.string()),
  /** Noi dung baseline trong code (DEFAULT_PROMPTS) */
  defaultContent: z.string(),
  /** Noi dung dang dung = version active hoac defaultContent */
  activeContent: z.string(),
  activeVersion: z.number().int().nullable(),
  source: z.enum(["db", "default"]),
  versions: z.array(promptTemplateVersionSchema),
});
export type PromptTemplateDetail = z.infer<typeof promptTemplateDetailSchema>;

/** POST /content/prompt-templates/:key/versions */
export const createPromptVersionRequestSchema = z.object({
  content: z.string().min(1, "Nội dung prompt không được để trống"),
});
export type CreatePromptVersionRequest = z.infer<typeof createPromptVersionRequestSchema>;

export const createPromptVersionResponseSchema = z.object({
  version: z.number().int(),
  /** Bien {{...}} khong nam trong danh sach hop le — canh bao, khong chan */
  unknownPlaceholders: z.array(z.string()),
});
export type CreatePromptVersionResponse = z.infer<typeof createPromptVersionResponseSchema>;

/** POST /content/prompt-templates/:key/activate */
export const activatePromptVersionRequestSchema = z.object({
  version: z.number().int().positive(),
});
export type ActivatePromptVersionRequest = z.infer<typeof activatePromptVersionRequestSchema>;
