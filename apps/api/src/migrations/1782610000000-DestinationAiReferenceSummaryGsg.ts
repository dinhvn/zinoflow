import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Cot GSG rieng cho "Tom tat cho AI viet bai" — TACH BIET voi ai_reference_summary
 * (nguon Skill thu cong) theo dung yeu cau: 2 nguon cung ton tai song song, khong
 * gop 1. CHI duoc ghi qua buoc "Chap nhan" trich xuat GSG, khong bi job ghi truc
 * tiep — cung nguyen tac voi cot _skill. dichoithoi-destination-ai-extraction-plan.md
 * §6 A2.
 */
export class DestinationAiReferenceSummaryGsg1782610000000 implements MigrationInterface {
  name = "DestinationAiReferenceSummaryGsg1782610000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN ai_reference_summary_gsg text NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN ai_reference_summary_gsg_updated_at timestamptz NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations DROP COLUMN ai_reference_summary_gsg_updated_at`,
    );
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations DROP COLUMN ai_reference_summary_gsg`,
    );
  }
}
