import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang nhap de xuat AI cho loai hinh (Type) — relations-plan §6.3, Giai doan B3.
 * AI danh gia lai TOAN BO diem den (theo tung cum) chi ghi vao day, KHONG bao
 * gio ghi thang v2.DestinationTypeMap. Trang Kanban (B2, /dichoithoi/phan-loai)
 * doc bang nay de hien san checkbox theo de xuat — nguoi dung xac nhan/sua roi
 * moi ghi that. 1 dong/diem den (upsert khi chay lai theo cum).
 */
export class DichoithoiTaxonomySuggestions1782180000000 implements MigrationInterface {
  name = "DichoithoiTaxonomySuggestions1782180000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_taxonomy_suggestions (
        destination_slug varchar(64) PRIMARY KEY
          REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        suggested_types jsonb NOT NULL,
        reason text NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dichoithoi_taxonomy_suggestions`);
  }
}
