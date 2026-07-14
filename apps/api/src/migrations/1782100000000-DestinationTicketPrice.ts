import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Mirror 1 chieu cot TicketPrice (van ban tu do, gia ve tai quay do CMS bai viet
 * quan ly) sang Postgres — cho phep trang /dichoithoi/ve hien thi + loc theo gia
 * ma khong phai goi rieng SQL Server tung dong (doc dichoithoi-ticket-analysis.md
 * §11.1). KHONG anh huong contentHash (chi tinh tren ContentHtml).
 */
export class DestinationTicketPrice1782100000000 implements MigrationInterface {
  name = "DestinationTicketPrice1782100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN ticket_price text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN ticket_price`);
  }
}
