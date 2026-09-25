import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ghi token/cost NGAY TREN tung ai_batch_item khi item thanh cong (dung usage
 * da tinh san trong CheckAiBatchUseCase, xem gemini-content-ai.provider.ts
 * usageFrom) — cho phep hien "tong chi phi/token" ca o muc batch (SUM cac
 * item) lan muc item rieng le, ap dung cho MOI taskType (kha ai_usage_logs
 * chi co jobId nen khong tra duoc usage cua batch destination/cluster —
 * xem docs/specs/ai-batch-mode.md).
 */
export class AiBatchItemUsage1782910000000 implements MigrationInterface {
  name = "AiBatchItemUsage1782910000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_batch_items
      ADD COLUMN IF NOT EXISTS input_tokens int NULL,
      ADD COLUMN IF NOT EXISTS output_tokens int NULL,
      ADD COLUMN IF NOT EXISTS cost_usd numeric(12,6) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_batch_items
      DROP COLUMN IF EXISTS input_tokens,
      DROP COLUMN IF EXISTS output_tokens,
      DROP COLUMN IF EXISTS cost_usd
    `);
  }
}
