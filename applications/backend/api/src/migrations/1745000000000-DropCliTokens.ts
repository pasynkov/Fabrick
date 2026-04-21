import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropCliTokens1745000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "cli_tokens"`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "cli_tokens" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId" character varying NOT NULL,
        "tokenHash" character varying NOT NULL UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }
}
