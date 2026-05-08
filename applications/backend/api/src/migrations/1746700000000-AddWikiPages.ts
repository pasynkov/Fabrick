import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWikiPages1746700000000 implements MigrationInterface {
  name = 'AddWikiPages1746700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "wiki_pages" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "projectId" uuid NOT NULL,
        "slug" varchar NOT NULL,
        "category" varchar NOT NULL,
        "title" varchar NOT NULL,
        "content" text NOT NULL,
        "sources" text[] NOT NULL DEFAULT '{}',
        "related" text[] NOT NULL DEFAULT '{}',
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "pk_wiki_pages" PRIMARY KEY ("id"),
        CONSTRAINT "uq_wiki_pages_project_slug" UNIQUE ("projectId", "slug"),
        CONSTRAINT "fk_wiki_pages_project" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "idx_wiki_pages_project" ON "wiki_pages" ("projectId")`);
    await queryRunner.query(`CREATE INDEX "idx_wiki_pages_category" ON "wiki_pages" ("projectId", "category")`);

    await queryRunner.query(`ALTER TABLE "repositories" ADD COLUMN "wikiContentHash" varchar(64) NULL DEFAULT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "repositories" DROP COLUMN "wikiContentHash"`);
    await queryRunner.query(`DROP INDEX "idx_wiki_pages_category"`);
    await queryRunner.query(`DROP INDEX "idx_wiki_pages_project"`);
    await queryRunner.query(`DROP TABLE "wiki_pages"`);
  }
}
