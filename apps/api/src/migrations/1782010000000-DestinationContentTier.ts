import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Them cot content_tier (flagship|standard|null) cho dichoithoi_destinations
 * (content-seo-ux-plan.md §10.6.1, Phase 25) — do uu tien noi dung, doc lap
 * voi kind. Chi co y nghia voi kind IN (province, cluster), gan tay boi admin.
 */
export class DestinationContentTier1782010000000 implements MigrationInterface {
  name = "DestinationContentTier1782010000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN content_tier varchar(16) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations DROP COLUMN IF EXISTS content_tier`,
    );
  }
}
