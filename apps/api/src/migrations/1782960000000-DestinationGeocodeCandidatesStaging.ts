import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang staging cho tinh nang geocode hang loat qua Google Places API (New)
 * (dichoithoi-destination-geocode-audit-plan.md Giai doan 1b) — 1 dong/diem
 * den (upsert khi chay lai), CMS hien bang duyet cho nguoi dung truoc khi
 * ghi that. Chi luu placeId + confidence + trang thai vinh vien (dung theo
 * dieu khoan Google) — snapshot noi dung (ten/dia chi/SDT/anh...) KHONG luu
 * o day, luon lay lai live qua endpoint suggest luc mo bang duyet.
 */
export class DestinationGeocodeCandidatesStaging1782960000000 implements MigrationInterface {
  name = "DestinationGeocodeCandidatesStaging1782960000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE dichoithoi_destination_geocode_candidates (
        destination_slug varchar(64) PRIMARY KEY
          REFERENCES dichoithoi_destinations(slug) ON DELETE CASCADE,
        found_at timestamptz NOT NULL,
        candidates jsonb NOT NULL,
        status varchar(16) NOT NULL DEFAULT 'pending'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE dichoithoi_destination_geocode_candidates`);
  }
}
