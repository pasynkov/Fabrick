import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlatformAdmin1748100000000 implements MigrationInterface {
  name = 'AddPlatformAdmin1748100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN "isPlatformAdmin" boolean NOT NULL DEFAULT false`,
    );

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

    await queryRunner.query(
      `CREATE INDEX "search_requests_created_at_desc_idx" ON "search_requests" ("createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "search_requests_created_at_desc_idx"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isPlatformAdmin"`);
  }
}
