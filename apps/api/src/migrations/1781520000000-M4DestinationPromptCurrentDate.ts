import type { MigrationInterface, QueryRunner } from "typeorm";
import { DEFAULT_PROMPTS } from "../modules/ai-content/application/services/default-prompts";

const TEMPLATE_KEY = "guide-diem-den.frame.vi";

/**
 * M4 Phase C — prompt frame diem den v2: updateNotice dung bien {{currentDate}}
 * thay vi de model tu suy thang/nam (chay thu Gemini ra "06/2024" du dang 06/2026).
 * Cung pattern M2: tat is_active version cu, insert version moi — truy nguoc duoc.
 */
export class M4DestinationPromptCurrentDate1781520000000 implements MigrationInterface {
  name = "M4DestinationPromptCurrentDate1781520000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const content = DEFAULT_PROMPTS[TEMPLATE_KEY];
    if (!content) throw new Error(`Thieu default prompt cho key ${TEMPLATE_KEY}`);
    await queryRunner.query(
      `UPDATE prompt_templates SET is_active = false WHERE template_key = $1`,
      [TEMPLATE_KEY],
    );
    await queryRunner.query(
      `INSERT INTO prompt_templates (id, template_key, version, content, is_active, created_at)
       VALUES (
         gen_random_uuid(), $1::varchar,
         COALESCE((SELECT MAX(version) FROM prompt_templates WHERE template_key = $1::varchar), 0) + 1,
         $2, true, now()
       )`,
      [TEMPLATE_KEY, content],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Xoa version moi nhat va bat lai version truoc do
    await queryRunner.query(
      `DELETE FROM prompt_templates WHERE template_key = $1
       AND version = (SELECT MAX(version) FROM prompt_templates WHERE template_key = $1)`,
      [TEMPLATE_KEY],
    );
    await queryRunner.query(
      `UPDATE prompt_templates SET is_active = true WHERE template_key = $1
       AND version = (SELECT MAX(version) FROM prompt_templates WHERE template_key = $1)`,
      [TEMPLATE_KEY],
    );
  }
}
