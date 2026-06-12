import type { MigrationInterface, QueryRunner } from "typeorm";
import { DEFAULT_PROMPTS } from "../modules/ai-content/application/services/default-prompts";

const DESTINATION_PROMPT_KEYS = [
  "guide-diem-den.outline.vi",
  "guide-diem-den.section.vi",
  "guide-diem-den.frame.vi",
] as const;

/**
 * M4 Phase B — seed prompt pack bai diem den dichoithoi (guide-diem-den)
 * tu DEFAULT_PROMPTS. Cung pattern M2: version moi + is_active, khong sua version cu.
 */
export class M4DestinationPrompts1781510000000 implements MigrationInterface {
  name = "M4DestinationPrompts1781510000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const templateKey of DESTINATION_PROMPT_KEYS) {
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
    for (const templateKey of DESTINATION_PROMPT_KEYS) {
      await queryRunner.query(`DELETE FROM prompt_templates WHERE template_key = $1`, [
        templateKey,
      ]);
    }
  }
}
