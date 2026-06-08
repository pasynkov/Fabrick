import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddV2EventTables1749000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE project_events (
        id char(26) PRIMARY KEY,
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id uuid NULL REFERENCES projects(id) ON DELETE CASCADE,
        repo_id uuid NULL REFERENCES repositories(id) ON DELETE CASCADE,
        scope text NULL,
        type text NOT NULL,
        parent_id char(26) NULL,
        base_sha text NULL,
        head_sha text NULL,
        title text NULL,
        bodies jsonb NULL,
        instructions text NULL,
        meta jsonb NOT NULL DEFAULT '{}',
        pr_number int NULL,
        at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_pe_org_at ON project_events (org_id, at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_pe_project_at ON project_events (project_id, at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_pe_repo_at ON project_events (repo_id, at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_pe_repo_scope_at ON project_events (repo_id, scope, at DESC)`);
    await queryRunner.query(`CREATE INDEX idx_pe_parent ON project_events (parent_id)`);
    await queryRunner.query(`CREATE INDEX idx_pe_type_at ON project_events (type, at DESC)`);

    await queryRunner.query(`
      CREATE TABLE dossier_pages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        repo_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
        scope text NOT NULL,
        slug text NOT NULL,
        title text NOT NULL,
        content text NOT NULL,
        sources text[] NOT NULL DEFAULT '{}',
        related text[] NOT NULL DEFAULT '{}',
        frontmatter jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_dossier_page UNIQUE (repo_id, scope, slug)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_dp_project_repo ON dossier_pages (project_id, repo_id)`);

    await queryRunner.query(`
      CREATE TABLE compendium_pages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        slug text NOT NULL,
        title text NOT NULL,
        content text NOT NULL,
        sources text[] NOT NULL DEFAULT '{}',
        related text[] NOT NULL DEFAULT '{}',
        frontmatter jsonb NOT NULL DEFAULT '{}',
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_compendium_page UNIQUE (project_id, slug)
      )
    `);

    await queryRunner.query(`CREATE INDEX idx_cp_project ON compendium_pages (project_id)`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS compendium_pages`);
    await queryRunner.query(`DROP TABLE IF EXISTS dossier_pages`);
    await queryRunner.query(`DROP TABLE IF EXISTS project_events`);
  }
}
