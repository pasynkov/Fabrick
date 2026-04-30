import { MigrationInterface, QueryRunner } from 'typeorm';

export class WidenKeyHash1745200000000 implements MigrationInterface {
  name = 'WidenKeyHash1745200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_key_audit_logs" ALTER COLUMN "keyHash" TYPE character varying(64)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_key_audit_logs" ALTER COLUMN "keyHash" TYPE character varying(16)`);
  }
}
