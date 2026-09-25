import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Them cot via ("sync" | "batch") vao ai_usage_logs — nguoi dung 08/2026 muon
 * phan biet duoc o /usage 1 lan goi AI la chay dong bo hay qua Gemini Batch
 * API. Log cu deu la sync (Batch AI moi build 01/08/2026) nen default 'sync'
 * la dung cho du lieu lich su, khong can backfill rieng.
 */
export class AiUsageLogVia1782920000000 implements MigrationInterface {
  name = "AiUsageLogVia1782920000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ADD COLUMN IF NOT EXISTS via varchar(10) NOT NULL DEFAULT 'sync'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE ai_usage_logs DROP COLUMN IF EXISTS via`);
  }
}
