import type { MigrationInterface, QueryRunner } from "typeorm";
import { DEFAULT_PROMPTS } from "../modules/ai-content/application/services/default-prompts";

const TEMPLATE_KEYS = [
  "guide-diem-den.frame.vi",
  "guide-diem-den.content.vi",
  "guide-diem-den-flagship.frame.vi",
  "guide-diem-den-flagship.content.vi",
] as const;

/**
 * Content-freshness-plan.md Giai doan E — bo huong dan "updateNotice" (dong
 * "cap nhat thang X/nam" AI viet cung) khoi 4 prompt frame/content diem den.
 * Badge "cap nhat" gio tinh dong tu ContentUpdatedAt/LastVerifiedAt
 * (v2.DestinationContent), khong con la text bake cung vao ContentHtml luc
 * generate — AI khong con can viet field nay nua. Cung pattern
 * M4DestinationPromptCurrentDate: tat is_active version cu, insert version moi.
 */
export class DestinationPromptRemoveUpdateNotice1782700000000 implements MigrationInterface {
  name = "DestinationPromptRemoveUpdateNotice1782700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const templateKey of TEMPLATE_KEYS) {
      const content = DEFAULT_PROMPTS[templateKey];
      if (!content) throw new Error(`Thieu default prompt cho key ${templateKey}`);
      await queryRunner.query(
        `UPDATE prompt_templates SET is_active = false WHERE template_key = $1`,
        [templateKey],
      );
      await queryRunner.query(
        `INSERT INTO prompt_templates (id, template_key, version, content, is_active, created_at)
         VALUES (
           gen_random_uuid(), $1::varchar,
           COALESCE((SELECT MAX(version) FROM prompt_templates WHERE template_key = $1::varchar), 0) + 1,
           $2, true, now()
         )`,
        [templateKey, content],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const templateKey of TEMPLATE_KEYS) {
      await queryRunner.query(
        `DELETE FROM prompt_templates WHERE template_key = $1
         AND version = (SELECT MAX(version) FROM prompt_templates WHERE template_key = $1)`,
        [templateKey],
      );
      await queryRunner.query(
        `UPDATE prompt_templates SET is_active = true WHERE template_key = $1
         AND version = (SELECT MAX(version) FROM prompt_templates WHERE template_key = $1)`,
        [templateKey],
      );
    }
  }
}
