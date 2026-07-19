import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Ghi lai prompt/response tho cua moi lan goi AI (yeu cau nguoi dung 07/2026) —
 * truoc day ai_usage_logs chi co tokens/cost/latency, khong the debug/audit lai
 * duoc AI da nhan prompt gi va tra ve gi cho 1 lan generate cu the.
 */
export class AiUsageLogPromptResponse1782220000000 implements MigrationInterface {
  name = "AiUsageLogPromptResponse1782220000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
        ADD COLUMN prompt_text text,
        ADD COLUMN response_text text;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE ai_usage_logs
        DROP COLUMN prompt_text,
        DROP COLUMN response_text;
    `);
  }
}
