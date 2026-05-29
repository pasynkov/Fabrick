import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUsageAnalytics1748000000000 implements MigrationInterface {
  name = 'AddUsageAnalytics1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "search_requests" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "projectId" uuid NOT NULL,
        "question" text NOT NULL,
        "reasoningRequested" boolean NOT NULL DEFAULT false,
        "iters" integer NOT NULL,
        "pagesRead" integer NOT NULL,
        "totalInputTokens" integer NOT NULL,
        "totalOutputTokens" integer NOT NULL,
        "durationMs" integer NOT NULL,
        "stopReason" varchar NOT NULL,
        "answerBrief" text NOT NULL,
        "answerReasoning" text NULL,
        "sources" text[] NOT NULL DEFAULT '{}',
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_search_requests" PRIMARY KEY ("id"),
        CONSTRAINT "fk_search_requests_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_search_requests_project_created" ON "search_requests" ("projectId", "createdAt" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE "token_usage" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "projectId" uuid NOT NULL,
        "searchRequestId" uuid NULL,
        "operation" varchar NOT NULL,
        "inputTokens" integer NOT NULL,
        "outputTokens" integer NOT NULL,
        "provider" varchar NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_token_usage" PRIMARY KEY ("id"),
        CONSTRAINT "fk_token_usage_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_token_usage_search_request" FOREIGN KEY ("searchRequestId") REFERENCES "search_requests"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_token_usage_project_created" ON "token_usage" ("projectId", "createdAt" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "idx_token_usage_project_created"`);
    await queryRunner.query(`DROP TABLE "token_usage"`);
    await queryRunner.query(`DROP INDEX "idx_search_requests_project_created"`);
    await queryRunner.query(`DROP TABLE "search_requests"`);
  }
}
