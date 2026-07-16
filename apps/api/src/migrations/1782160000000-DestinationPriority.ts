import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Gop is_featured (bool) thanh priority (smallint 1-5, 1=cao nhat, mac dinh 3) —
 * dichoithoi-destination-relations-plan.md §1.1 (Giai doan A1). Backfill:
 * is_featured=true -> priority=1, is_featured=false -> priority=3 (giu nguyen
 * ngu nghia "chua duoc danh gia tay"). Xoa is_featured sau khi backfill xong,
 * khong giu 2 cot song song (de dam bao thu tu chay dung, xem tai QueryRunner
 * pham nhu 1 transaction).
 */
export class DestinationPriority1782160000000 implements MigrationInterface {
  name = "DestinationPriority1782160000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN priority smallint NOT NULL DEFAULT 3`,
    );
    await queryRunner.query(
      `UPDATE dichoithoi_destinations SET priority = 1 WHERE is_featured = true`,
    );
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN is_featured`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE dichoithoi_destinations ADD COLUMN is_featured boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `UPDATE dichoithoi_destinations SET is_featured = true WHERE priority <= 2`,
    );
    await queryRunner.query(`ALTER TABLE dichoithoi_destinations DROP COLUMN priority`);
  }
}
