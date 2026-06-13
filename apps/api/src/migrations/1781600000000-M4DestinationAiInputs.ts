import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * M4 — luu lai thong tin nguoi dung cung cap cho AI tren tung diem den:
 * ghi chu (ai_notes) + danh sach URL nguon tham khao (ai_reference_urls).
 * De form tu dien lai va tai dung khi viet lai bai.
 */
export class M4DestinationAiInputs1781600000000 implements MigrationInterface {
  name = "M4DestinationAiInputs1781600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dichoithoi_destinations" ADD COLUMN IF NOT EXISTS "ai_notes" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "dichoithoi_destinations" ADD COLUMN IF NOT EXISTS "ai_reference_urls" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dichoithoi_destinations" DROP COLUMN IF EXISTS "ai_reference_urls"`,
    );
    await queryRunner.query(
      `ALTER TABLE "dichoithoi_destinations" DROP COLUMN IF EXISTS "ai_notes"`,
    );
  }
}
