import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformAdmin1748100000000 implements MigrationInterface {
  name = 'AddPlatformAdmin1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1.1 Add is_platform_admin column
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "isPlatformAdmin" boolean NOT NULL DEFAULT false`,
    );

    // 1.2 Idempotent backfill: set first user as platform admin if none exists
    await queryRunner.query(`
      UPDATE "users"
      SET "isPlatformAdmin" = true
      WHERE "id" = (
        SELECT "id" FROM "users" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM "users" WHERE "isPlatformAdmin" = true
      )
    `);

    // 1.3 Add index for global search-requests feed
    await queryRunner.query(
      `CREATE INDEX "search_requests_created_at_desc_idx" ON "search_requests" ("createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "search_requests_created_at_desc_idx"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isPlatformAdmin"`);
  }
}
