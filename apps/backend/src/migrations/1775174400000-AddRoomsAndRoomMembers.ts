import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoomsAndRoomMembers1775174400000 implements MigrationInterface {
  name = 'AddRoomsAndRoomMembers1775174400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE "room_member_role_enum" AS ENUM ('owner', 'member')`);

    await queryRunner.query(`
      CREATE TABLE "rooms" (
        "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "name"         VARCHAR NOT NULL,
        "owner_id"     UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "invite_code"  VARCHAR NOT NULL UNIQUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "room_members" (
        "id"        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "room_id"   UUID NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
        "user_id"   UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "role"      "room_member_role_enum" NOT NULL,
        "joined_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE UNIQUE INDEX "idx_room_members_room_user" ON "room_members"("room_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX "idx_rooms_owner_id" ON "rooms"("owner_id")`);
    await queryRunner.query(`CREATE INDEX "idx_room_members_room_id" ON "room_members"("room_id")`);
    await queryRunner.query(`CREATE INDEX "idx_room_members_user_id" ON "room_members"("user_id")`);

    await queryRunner.query(`
      ALTER TABLE "receipts"
      ADD COLUMN "room_id" UUID REFERENCES "rooms"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`CREATE INDEX "idx_receipts_room_id" ON "receipts"("room_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_receipts_room_id"`);
    await queryRunner.query(`ALTER TABLE "receipts" DROP COLUMN "room_id"`);
    await queryRunner.query(`DROP INDEX "idx_room_members_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_room_members_room_id"`);
    await queryRunner.query(`DROP INDEX "idx_rooms_owner_id"`);
    await queryRunner.query(`DROP INDEX "idx_room_members_room_user"`);
    await queryRunner.query(`DROP TABLE "room_members"`);
    await queryRunner.query(`DROP TABLE "rooms"`);
    await queryRunner.query(`DROP TYPE "room_member_role_enum"`);
  }
}
