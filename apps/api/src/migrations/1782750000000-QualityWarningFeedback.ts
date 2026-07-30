import type { MigrationInterface, QueryRunner } from "typeorm";

/** Luu dismiss reason de do false positive cua warning gate. */
export class QualityWarningFeedback1782750000000 implements MigrationInterface {
  name = "QualityWarningFeedback1782750000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE quality_warning_feedback (
        id uuid PRIMARY KEY,
        target_type varchar(20) NOT NULL,
        target_id varchar(128) NOT NULL,
        gate_name varchar(50) NOT NULL,
        detail_hash varchar(64) NOT NULL,
        reason text NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX idx_quality_warning_feedback_target ON quality_warning_feedback (target_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE quality_warning_feedback`);
  }
}
