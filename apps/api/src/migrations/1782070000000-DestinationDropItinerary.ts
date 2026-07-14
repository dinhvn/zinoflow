import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * "Lich trinh goi y" (Phase 28.0) chuyen tu JSON co cau truc rieng (form
 * nhap tay + poiSlug auto-link + tour-CTA theo duration_days) sang prose
 * thuong trong sections (blockKey "lich-trinh"), giong moi khoi noi dung
 * khac — quyet dinh cua chu site 07/2026: chap nhan mat 2 tinh nang tu dong
 * do de doi lay 1 UX soan bai duy nhat. Cot SQL Server ItineraryJson KHONG
 * bi dong tu repo nay (schema do dichoithoi so huu) — chi ngung doc/ghi, du
 * lieu cu tren do coi la rac, khong con duong nao ghi de nua.
 */
export class DestinationDropItinerary1782070000000 implements MigrationInterface {
  name = "DestinationDropItinerary1782070000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN itinerary`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN itinerary jsonb NOT NULL DEFAULT '[]'`,
    );
  }
}
