import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomInvitations1776249600000 implements MigrationInterface {
  name = 'AddRoomInvitations1776249600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "room_invitations" (
        "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "room_id"    UUID NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
        "token"      VARCHAR(64) NOT NULL UNIQUE,
        "created_by" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "expires_at" TIMESTAMPTZ NOT NULL,
        "used_by"    UUID REFERENCES "users"("id") ON DELETE SET NULL,
        "used_at"    TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "idx_room_invitations_room_expires" ON "room_invitations"("room_id", "expires_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_room_invitations_room_expires"`);
    await queryRunner.query(`DROP TABLE "room_invitations"`);
  }
}
