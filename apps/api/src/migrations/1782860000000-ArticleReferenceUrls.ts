import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Website tham khao cho bai cam nang (article-ai-extraction-plan.md GĐ1) —
 * dung lam nguon cho skill Claude Code + Google Search Grounding truoc khi
 * AI viet bai.
 */
export class ArticleReferenceUrls1782860000000 implements MigrationInterface {
  name = "ArticleReferenceUrls1782860000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_jobs
        ADD COLUMN IF NOT EXISTS reference_urls jsonb NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN IF EXISTS reference_urls`);
  }
}
