import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPromptRevisionIdToAnalytics1748200200000 implements MigrationInterface {
  name = 'AddPromptRevisionIdToAnalytics1748200200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "search_requests" ADD COLUMN "promptRevisionId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "search_requests" ADD CONSTRAINT "fk_search_requests_prompt_revision"
       FOREIGN KEY ("promptRevisionId") REFERENCES "prompt_revisions"("id") ON DELETE SET NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "token_usage" ADD COLUMN "promptRevisionId" uuid NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_usage" ADD CONSTRAINT "fk_token_usage_prompt_revision"
       FOREIGN KEY ("promptRevisionId") REFERENCES "prompt_revisions"("id") ON DELETE SET NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "token_usage" DROP CONSTRAINT "fk_token_usage_prompt_revision"`,
    );
    await queryRunner.query(
      `ALTER TABLE "token_usage" DROP COLUMN "promptRevisionId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "search_requests" DROP CONSTRAINT "fk_search_requests_prompt_revision"`,
    );
    await queryRunner.query(
      `ALTER TABLE "search_requests" DROP COLUMN "promptRevisionId"`,
    );
  }
}
