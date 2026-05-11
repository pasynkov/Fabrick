## ADDED Requirements

### Requirement: wiki_pages table stores project-level wiki

The database SHALL contain a `wiki_pages` table with columns: `id` (uuid PK), `project_id` (uuid FK → projects ON DELETE CASCADE), `slug` (text), `category` (text), `title` (text), `content` (text), `sources` (text array — repo slugs), `related` (text array — page slugs), `updated_at` (timestamptz). UNIQUE constraint on `(project_id, slug)`. Index on `(project_id)` and `(project_id, category)`.

#### Scenario: Page upserted with unique slug
- **WHEN** synthesis upserts page with slug `entities/user` for project `abc`
- **THEN** row exists with matching project_id and slug

#### Scenario: Re-upsert updates content
- **WHEN** same slug upserted twice for same project
- **THEN** one row exists with latest content and updated_at

### Requirement: Internal endpoint accepts page upserts from synthesis worker

API SHALL expose `PUT /internal/synthesis/pages` accepting `{ projectId, callbackToken, pages: [{ slug, category, title, content, sources, related }] }`. Token validated as `scope: "synth-callback"` and `sub === projectId`. Each page upserted via ON CONFLICT DO UPDATE.

#### Scenario: Valid batch upsert
- **WHEN** worker sends 15 pages with valid token
- **THEN** all 15 upserted, returns 200

#### Scenario: Invalid token rejected
- **WHEN** token missing or wrong scope
- **THEN** 401, no rows written

### Requirement: Internal endpoint returns existing pages for project

API SHALL expose `GET /internal/synthesis/pages?projectId=...` returning all wiki_pages for a project (with content). Protected by callbackToken. Used by synthesis worker to load existing pages for incremental synthesis.

#### Scenario: Project with 20 pages
- **WHEN** worker requests pages for project with 20 existing pages
- **THEN** all 20 returned with full content

#### Scenario: Project with no pages
- **WHEN** worker requests pages for new project
- **THEN** empty array returned

### Requirement: Public endpoint reads page by slug

`GET /orgs/:org/projects/:project/synthesis/file?path=<slug>` SHALL query `wiki_pages WHERE project_id = ? AND slug = ?`. Returns content as plain text. Returns 404 if not found.

#### Scenario: Known slug
- **WHEN** `?path=entities/user` and page exists
- **THEN** 200 with markdown content

#### Scenario: Unknown slug
- **WHEN** `?path=entities/ghost` and no such page
- **THEN** 404
