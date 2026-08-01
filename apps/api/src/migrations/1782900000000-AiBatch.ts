import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Batch AI tong quat (Gemini Batch API) — docs/specs/ai-batch-mode.md.
 * content_jobs.generation_mode: sync (mac dinh, tu chay ngay) | batch (nguoi
 * dung tu gui qua Batch AI, khong tu enqueue). ai_batches/ai_batch_items:
 * theo doi tung lan gui batch — entity_id da hinh (contentJobId | destination
 * slug | cluster slug tuy taskType), khong FK vi tro toi nhieu bang khac nhau.
 */
export class AiBatch1782900000000 implements MigrationInterface {
  name = "AiBatch1782900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE content_jobs
      ADD COLUMN IF NOT EXISTS generation_mode varchar(10) NOT NULL DEFAULT 'sync'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_batches (
        id uuid PRIMARY KEY,
        task_type varchar(40) NOT NULL,
        provider varchar(20) NOT NULL,
        model varchar(100) NOT NULL,
        provider_batch_name text NOT NULL,
        status varchar(10) NOT NULL DEFAULT 'submitted',
        item_count int NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        checked_at timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_batches_task_type ON ai_batches (task_type)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_batches_created_at ON ai_batches (created_at)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_batch_items (
        id uuid PRIMARY KEY,
        batch_id uuid NOT NULL REFERENCES ai_batches(id) ON DELETE CASCADE,
        entity_id varchar(128) NOT NULL,
        params jsonb NULL,
        status varchar(10) NOT NULL DEFAULT 'pending',
        error_message text NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_ai_batch_items_batch_id ON ai_batch_items (batch_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_batch_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_batches`);
    await queryRunner.query(`ALTER TABLE content_jobs DROP COLUMN IF EXISTS generation_mode`);
  }
}
