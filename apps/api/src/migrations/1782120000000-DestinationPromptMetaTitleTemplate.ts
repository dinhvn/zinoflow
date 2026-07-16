import type { MigrationInterface, QueryRunner } from "typeorm";
import { DEFAULT_PROMPTS } from "../modules/ai-content/application/services/default-prompts";

const TEMPLATE_KEYS = ["guide-diem-den.frame.vi", "guide-diem-den-flagship.frame.vi"] as const;

/**
 * metaTitle truoc day chi gioi han do dai (<=140 ky tu), khong co cau truc -> AI/du lieu
 * import cu ra title cut ngun (vd "Doi Cu" thay vi "Doi Cu Da Lat: Gia Ve, Gio Mo Cua...").
 * Version moi: bat buoc 50-60 ky tu, cau truc {Ten} {Tinh}: {khia canh theo quickFacts},
 * khac voi title (H1) de tranh 2 the trung chu. Cung pattern M2/M4: tat version cu, insert
 * version moi, truy nguoc duoc qua down().
 */
export class DestinationPromptMetaTitleTemplate1782120000000 implements MigrationInterface {
  name = "DestinationPromptMetaTitleTemplate1782120000000";

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
