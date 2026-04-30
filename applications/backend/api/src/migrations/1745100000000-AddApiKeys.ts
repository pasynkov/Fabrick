import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApiKeys1745100000000 implements MigrationInterface {
  name = 'AddApiKeys1745100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizations" ADD "anthropicApiKey" text`);
    await queryRunner.query(`ALTER TABLE "projects" ADD "anthropicApiKey" text`);

    await queryRunner.query(`
      CREATE TABLE "api_key_audit_logs" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "action" character varying(50) NOT NULL,
        "level" character varying(20) NOT NULL,
        "organizationId" uuid NULL,
        "projectId" uuid NULL,
        "userId" character varying NOT NULL,
        "keyHash" character varying(16) NOT NULL,
        "details" text NULL,
        "ipAddress" character varying(45) NULL,
        "userAgent" text NULL,
        "timestamp" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX "idx_organizations_api_key" ON "organizations" ("anthropicApiKey") WHERE "anthropicApiKey" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "idx_projects_api_key" ON "projects" ("anthropicApiKey") WHERE "anthropicApiKey" IS NOT NULL`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_org_id" ON "api_key_audit_logs" ("organizationId")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_project_id" ON "api_key_audit_logs" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_timestamp" ON "api_key_audit_logs" ("timestamp")`);
    await queryRunner.query(`CREATE INDEX "idx_audit_logs_key_hash" ON "api_key_audit_logs" ("keyHash")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_audit_logs_key_hash"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_timestamp"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_project_id"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_org_id"`);
    await queryRunner.query(`DROP INDEX "idx_projects_api_key"`);
    await queryRunner.query(`DROP INDEX "idx_organizations_api_key"`);
    await queryRunner.query(`DROP TABLE "api_key_audit_logs"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "anthropicApiKey"`);
    await queryRunner.query(`ALTER TABLE "organizations" DROP COLUMN "anthropicApiKey"`);
  }
}
