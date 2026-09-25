import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2 cot moi cho tinh nang "xem đã gửi/nhận" cua 1 item trong Batch AI
 * (/ai-batches), lien ket duoc sang dung dong o /usage (nguoi dung yeu cau
 * 08/2026):
 * - ai_batch_items.request_text: prompt log day du (system+prompt+response
 *   schema) chup luc SUBMIT batch — luong batch truoc gio KHONG luu prompt
 *   (bi huy sau khi gui di Google), nen ai_usage_logs cua item batch luon
 *   thieu promptText. Chup lai o day de con dua vao ai_usage_logs luc "Kiem
 *   tra" (check-ai-batch.usecase.ts).
 * - ai_usage_logs.batch_item_id: lien ket 1 dong usage log ve dung 1 item
 *   batch da tao ra no — cac taskType dua tren destination/cluster slug
 *   (destination-gsg-extraction, cluster-poi-discovery) khong co jobId nen
 *   truoc gio khong co cach nao tra nguoc lai duoc.
 */
export class AiBatchItemRequestTextAndUsageLink1782930000000 implements MigrationInterface {
  name = "AiBatchItemRequestTextAndUsageLink1782930000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_batch_items
      ADD COLUMN IF NOT EXISTS request_text text
    `);
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
      ADD COLUMN IF NOT EXISTS batch_item_id uuid
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_batch_item_id
      ON ai_usage_logs (batch_item_id)
      WHERE batch_item_id IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_ai_usage_logs_batch_item_id`);
    await queryRunner.query(`ALTER TABLE ai_usage_logs DROP COLUMN IF EXISTS batch_item_id`);
    await queryRunner.query(`ALTER TABLE ai_batch_items DROP COLUMN IF EXISTS request_text`);
  }
}
