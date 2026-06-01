import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptRevisions1748200000000 implements MigrationInterface {
  name = 'AddPromptRevisions1748200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "prompt_revisions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "agent" varchar NOT NULL,
        "revision" integer NOT NULL,
        "content" jsonb NOT NULL,
        "note" text NULL,
        "createdBy" varchar NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_prompt_revisions" PRIMARY KEY ("id"),
        CONSTRAINT "uq_prompt_revisions_name_agent_revision" UNIQUE ("name", "agent", "revision")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_prompt_revisions_name_agent_revision_desc" ON "prompt_revisions" ("name", "agent", "revision" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_prompt_revisions_name_agent_revision_desc"`);
    await queryRunner.query(`DROP TABLE "prompt_revisions"`);
  }
}
