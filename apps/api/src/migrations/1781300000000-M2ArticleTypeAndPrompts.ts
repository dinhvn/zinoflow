import type { MigrationInterface, QueryRunner } from "typeorm";
import { DEFAULT_PROMPTS } from "../modules/ai-content/application/services/default-prompts";

/**
 * M2 — generation pipeline 3 buoc:
 * 1. content_jobs.article_type: loai bai (toplist | review) quyet dinh prompt pack.
 * 2. Seed prompt templates TIENG VIET CO DAU tu DEFAULT_PROMPTS (1 nguon su that):
 *    - cac key da ton tai (toplist.outline.vi, toplist.section.vi v1 khong dau):
 *      tat is_active cua version cu, insert version moi — KHONG sua version cu
 *      (rule: doi prompt = version moi, de truy nguoc bai nao sinh boi prompt nao).
 *    - key moi (frame, review, system): insert version 1.
 */
export class M2ArticleTypeAndPrompts1781300000000 implements MigrationInterface {
  name = "M2ArticleTypeAndPrompts1781300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_jobs
      ADD COLUMN article_type varchar(20) NOT NULL DEFAULT 'toplist'
    `);

    for (const [templateKey, content] of Object.entries(DEFAULT_PROMPTS)) {
      await queryRunner.query(
        `UPDATE prompt_templates SET is_active = false WHERE template_key = $1`,
        [templateKey],
      );
      await queryRunner.query(
        // $1 dung o 2 vi tri (varchar + so sanh) -> phai cast de Postgres suy duoc kieu
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
    // Xoa version cao nhat cua tung key da seed o up(), bat lai version truoc do (neu co)
    for (const templateKey of Object.keys(DEFAULT_PROMPTS)) {
      await queryRunner.query(
        `DELETE FROM prompt_templates
         WHERE template_key = $1
           AND version = (SELECT MAX(version) FROM prompt_templates WHERE template_key = $1)`,
        [templateKey],
      );
      await queryRunner.query(
        `UPDATE prompt_templates SET is_active = true
         WHERE template_key = $1
           AND version = (SELECT MAX(version) FROM prompt_templates WHERE template_key = $1)`,
        [templateKey],
      );
    }

    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN article_type`);
  }
}
