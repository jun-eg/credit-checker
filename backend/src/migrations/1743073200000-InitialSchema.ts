import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1743073200000 implements MigrationInterface {
  name = 'InitialSchema1743073200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "email"        VARCHAR NOT NULL UNIQUE,
        "display_name" VARCHAR,
        "avatar_url"   VARCHAR,
        "google_id"    VARCHAR UNIQUE,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "receipt_status_enum" AS ENUM ('pending', 'processing', 'completed', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "receipts" (
        "id"                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id"            UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "s3_key"             VARCHAR NOT NULL,
        "original_file_name" VARCHAR NOT NULL,
        "status"             "receipt_status_enum" NOT NULL DEFAULT 'pending',
        "purchased_at"       TIMESTAMPTZ,
        "store_name"         VARCHAR,
        "total"              DECIMAL(10,2),
        "currency"           CHAR(3),
        "raw_text"           TEXT,
        "created_at"         TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at"         TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "receipt_items" (
        "id"          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "receipt_id"  UUID NOT NULL REFERENCES "receipts"("id") ON DELETE CASCADE,
        "name"        VARCHAR NOT NULL,
        "quantity"    INTEGER NOT NULL DEFAULT 1,
        "unit_price"  DECIMAL(10,2) NOT NULL,
        "total_price" DECIMAL(10,2) NOT NULL,
        "category"    VARCHAR,
        "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_sessions" (
        "id"         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "user_id"    UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "title"      VARCHAR,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "message_role_enum" AS ENUM ('user', 'assistant', 'tool')
    `);

    await queryRunner.query(`
      CREATE TABLE "chat_messages" (
        "id"           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "session_id"   UUID NOT NULL REFERENCES "chat_sessions"("id") ON DELETE CASCADE,
        "role"         "message_role_enum" NOT NULL,
        "content"      TEXT NOT NULL,
        "tool_name"    VARCHAR,
        "tool_call_id" VARCHAR,
        "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_receipts_user_id" ON "receipts"("user_id")`);
    await queryRunner.query(
      `CREATE INDEX "idx_receipt_items_receipt_id" ON "receipt_items"("receipt_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_sessions_user_id" ON "chat_sessions"("user_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_chat_messages_session_id" ON "chat_messages"("session_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_chat_messages_session_id"`);
    await queryRunner.query(`DROP INDEX "idx_chat_sessions_user_id"`);
    await queryRunner.query(`DROP INDEX "idx_receipt_items_receipt_id"`);
    await queryRunner.query(`DROP INDEX "idx_receipts_user_id"`);
    await queryRunner.query(`DROP TABLE "chat_messages"`);
    await queryRunner.query(`DROP TYPE "message_role_enum"`);
    await queryRunner.query(`DROP TABLE "chat_sessions"`);
    await queryRunner.query(`DROP TABLE "receipt_items"`);
    await queryRunner.query(`DROP TABLE "receipts"`);
    await queryRunner.query(`DROP TYPE "receipt_status_enum"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
