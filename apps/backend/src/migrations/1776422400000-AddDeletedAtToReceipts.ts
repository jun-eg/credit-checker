import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeletedAtToReceipts1776422400000 implements MigrationInterface {
  name = 'AddDeletedAtToReceipts1776422400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "receipts"
      ADD COLUMN "deleted_at" TIMESTAMPTZ
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_receipts_deleted_at" ON "receipts" ("deleted_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "IDX_receipts_deleted_at"
    `);
    await queryRunner.query(`
      ALTER TABLE "receipts"
      DROP COLUMN "deleted_at"
    `);
  }
}
