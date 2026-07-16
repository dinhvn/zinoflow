import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 2 cot that moi cho tinh nang trich xuat AI (dichoithoi-destination-ai-extraction-plan.md
 * §2.2) — CHI duoc ghi qua buoc "Chap nhan" (Giai doan 3), khong bi extraction job ghi
 * truc tiep. opening_hours.periods danh cho JSON-LD sau nay (Giai doan 4, cross-repo).
 */
export class DestinationOpeningHoursAiSummary1782150000000 implements MigrationInterface {
  name = "DestinationOpeningHoursAiSummary1782150000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN opening_hours jsonb NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN ai_reference_summary text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN ai_reference_summary_updated_at timestamptz NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations DROP COLUMN ai_reference_summary_updated_at`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations DROP COLUMN ai_reference_summary`,
    );
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN opening_hours`);
  }
}
