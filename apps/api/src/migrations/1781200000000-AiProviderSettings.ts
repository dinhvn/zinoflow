import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang ai_provider_settings — bat/tat provider tu trang Settings.
 * Provider khong co row = enabled (default). Chi luu khi user thay doi.
 */
export class AiProviderSettings1781200000000 implements MigrationInterface {
  name = "AiProviderSettings1781200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE ai_provider_settings (
        provider_key varchar(20) PRIMARY KEY,
        is_enabled   boolean NOT NULL DEFAULT true,
        updated_at   timestamptz NOT NULL
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_provider_settings`);
  }
}
