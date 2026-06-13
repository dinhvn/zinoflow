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

/** Ban ghi day du 1 version (cho man quan ly: lich su + rollback). */
export interface PromptTemplateVersionRecord extends PromptTemplateRecord {
  isActive: boolean;
  createdAt: Date;
}

export interface PromptTemplateRepository {
  /** Version active moi nhat cua templateKey; null neu chua seed. */
  findActive(templateKey: string): Promise<PromptTemplateRecord | null>;

  /** Version active cua nhieu key 1 luot (man list) — key chua co row thi vang mat. */
  findActiveMany(templateKeys: readonly string[]): Promise<PromptTemplateVersionRecord[]>;

  /** Lich su moi version cua 1 key, version giam dan. */
  findVersions(templateKey: string): Promise<PromptTemplateVersionRecord[]>;

  /**
   * Tao version moi (= max version + 1) va dat lam active duy nhat.
   * KHONG sua version cu — moi lan doi prompt la 1 ban ghi moi (truy nguyen duoc).
   */
  createVersion(templateKey: string, content: string): Promise<PromptTemplateVersionRecord>;

  /** Kich hoat lai 1 version cu (rollback): bat version do, tat cac version khac cua key. */
  activateVersion(templateKey: string, version: number): Promise<void>;
}
