import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Bang destination_tickets — thay ticketLinks[] nhung trong dichoithoi_destinations
 * bang bang rieng, quan ly giong Hotel/Tour (doc dichoithoi-ticket-analysis.md §11.5).
 * Khong can migrate du lieu cu (0/272 diem co ticketLinks that luc quyet dinh).
 * Khong co status (an tam khong xoa han) — xoa la xoa that, don gian truoc, mo
 * rong sau neu can. Khong FK toi dichoithoi_destinations (giong hotel_destination_map
 * — bang do la mirror, khong phai nguon su that quan he).
 */
export class DestinationTickets1782090000000 implements MigrationInterface {
  name = "DestinationTickets1782090000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE destination_tickets (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        destination_slug  varchar(64) NOT NULL,
        label             varchar(128) NULL,
        provider          varchar(64) NOT NULL,
        source_url        varchar(1024) NOT NULL,
        affiliate_url     varchar(1024) NOT NULL,
        link_status       varchar(20) NOT NULL DEFAULT 'no-rule',
        price             numeric(12,0) NULL,
        thumbnail_url     varchar(512) NULL,
        "order"           int NOT NULL DEFAULT 0,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_destination_tickets_slug ON destination_tickets (destination_slug)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS destination_tickets`);
  }
}
