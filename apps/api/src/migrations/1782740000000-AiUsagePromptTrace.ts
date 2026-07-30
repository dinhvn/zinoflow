import type { MigrationInterface, QueryRunner } from "typeorm";

/** Them metadata tai lap prompt/source cho moi AI call; row cu giu null. */
export class AiUsagePromptTrace1782740000000 implements MigrationInterface {
  name = "AiUsagePromptTrace1782740000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
        ADD COLUMN prompt_key varchar(100),
        ADD COLUMN prompt_version int,
        ADD COLUMN prompt_source varchar(16),
        ADD COLUMN source_context_hash varchar(64);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
        DROP COLUMN source_context_hash,
        DROP COLUMN prompt_source,
        DROP COLUMN prompt_version,
        DROP COLUMN prompt_key;
    `);
  }
}
