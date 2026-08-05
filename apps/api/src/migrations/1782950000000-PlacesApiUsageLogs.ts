import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Dem so lan goi Google Places API trong thang (dichoithoi-destination-
 * geocode-audit-plan.md) — canh bao nguong free-tier Enterprise SKU
 * (800/1000), dung chung cho che do tung diem lan hang loat.
 */
export class PlacesApiUsageLogs1782950000000 implements MigrationInterface {
  name = "PlacesApiUsageLogs1782950000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_places_api_usage_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        called_at timestamptz NOT NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_places_api_usage_logs_called_at ON dichoithoi_places_api_usage_logs (called_at)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dichoithoi_places_api_usage_logs`);
  }
}
