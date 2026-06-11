/**
 * Port doc prompt template tu DB (bang prompt_templates) — M2.
 * Doi prompt = tao version moi + chuyen is_active, KHONG sua version cu
 * (de truy nguoc bai nao duoc generate boi prompt version nao).
 */
export const PROMPT_TEMPLATE_REPOSITORY = Symbol("PROMPT_TEMPLATE_REPOSITORY");

export interface PromptTemplateRecord {
  id: string;
  templateKey: string;
  version: number;
  content: string;
}

export interface PromptTemplateRepository {
  /** Version active moi nhat cua templateKey; null neu chua seed. */
  findActive(templateKey: string): Promise<PromptTemplateRecord | null>;
}
