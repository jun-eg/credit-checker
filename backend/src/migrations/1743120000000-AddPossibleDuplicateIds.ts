import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPossibleDuplicateIds1743120000000 implements MigrationInterface {
  name = 'AddPossibleDuplicateIds1743120000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "receipts"
      ADD COLUMN "possible_duplicate_ids" JSONB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "receipts"
      DROP COLUMN "possible_duplicate_ids"
    `);
  }
}
