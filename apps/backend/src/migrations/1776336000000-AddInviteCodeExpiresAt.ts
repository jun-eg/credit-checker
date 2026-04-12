import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInviteCodeExpiresAt1776336000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rooms"
      ADD COLUMN "invite_code_expires_at" TIMESTAMPTZ NOT NULL
      DEFAULT NOW() + INTERVAL '30 minutes'
    `);

    // 既存ルームにも30分の期限を設定（運用上、再生成を促す）
    await queryRunner.query(`
      UPDATE "rooms"
      SET "invite_code_expires_at" = NOW() + INTERVAL '30 minutes'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "rooms"
      DROP COLUMN "invite_code_expires_at"
    `);
  }
}
