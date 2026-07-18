import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Checkpoint tien do generate (outline + section da xong) de resume khi worker
 * chet giua chung thay vi chay lai tu dau — xem generate-content.usecase.ts.
 */
export class ContentGenerationCheckpoint1782230000000 implements MigrationInterface {
  name = "ContentGenerationCheckpoint1782230000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE content_generation_checkpoints (
        job_id uuid PRIMARY KEY REFERENCES content_jobs(id) ON DELETE CASCADE,
        outline_json jsonb,
        sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE content_generation_checkpoints;`);
  }
}
