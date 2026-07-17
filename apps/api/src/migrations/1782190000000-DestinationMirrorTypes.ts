import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Mirror hoa tap loai hinh (Type, nhieu-nhieu) sang Postgres — relations-plan §1.4
 * muc 1, Giai doan C1. Chi dong bo SAU khi Giai doan B (chuan hoa taxonomy) xong,
 * xem SyncDestinationsUseCase/fetchAllDestinations(). Mang rong = chua co Type nao
 * hoac kind != poi (province/cluster khong gan Type).
 */
export class DestinationMirrorTypes1782190000000 implements MigrationInterface {
  name = "DestinationMirrorTypes1782190000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "dichoithoi_destinations" ADD COLUMN "types" jsonb NOT NULL DEFAULT '[]'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dichoithoi_destinations" DROP COLUMN "types"`);
  }
}
