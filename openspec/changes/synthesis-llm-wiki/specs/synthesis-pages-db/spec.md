## ADDED Requirements

### Requirement: synthesis_pages table stores concept-organized pages
The database SHALL contain a `synthesis_pages` table with columns: `id` (uuid PK), `project_id` (uuid FK → projects), `slug` (text), `category` (text), `title` (text), `content` (text, markdown), `sources` (text array, repo slugs), `updated_at` (timestamptz). UNIQUE constraint on `(project_id, slug)`.

#### Scenario: Page upserted with unique slug per project
- **WHEN** synthesis upserts a page with slug `entities/User` for project `abc`
- **THEN** row exists in `synthesis_pages` with `project_id = abc`, `slug = "entities/User"`

#### Scenario: Re-upsert updates content, not duplicate row
- **WHEN** synthesis upserts the same slug twice for the same project
- **THEN** only one row exists; `content` and `updated_at` reflect the second write

### Requirement: Internal endpoint accepts page upserts from synthesis worker
API SHALL expose `PUT /internal/synthesis/pages` accepting `Authorization: Bearer <callbackToken>` and body `{ projectId: string, pages: Array<{ slug, category, title, content, sources }> }`. Token validated as `scope: "synth-callback"` and `sub === projectId`. Each page is upserted into `synthesis_pages`.

#### Scenario: Valid batch upsert
- **WHEN** synthesis worker POSTs 12 pages with valid callbackToken for project `abc`
- **THEN** API upserts all 12 rows, returns 200

#### Scenario: Invalid token rejected
- **WHEN** request arrives with missing or wrong-scope token
- **THEN** API returns 401, no rows written

#### Scenario: Token sub mismatch rejected
- **WHEN** callbackToken.sub is `project-X` but body.projectId is `project-Y`
- **THEN** API returns 401

### Requirement: Public endpoint returns page content by slug
API SHALL handle `GET /orgs/:org/projects/:project/synthesis/file?path=<slug>` by querying `synthesis_pages WHERE project_id = ? AND slug = path`. Returns page content as plain text. Returns 404 if slug not found.

#### Scenario: Known slug returns content
- **WHEN** `GET /synthesis/file?path=entities/User` is called for a project with that page
- **THEN** response is 200 with markdown content of that page

#### Scenario: Unknown slug returns 404
- **WHEN** `GET /synthesis/file?path=entities/Ghost` is called and no such page exists
- **THEN** response is 404

### Requirement: Public endpoint lists all pages for a project
API SHALL handle `GET /orgs/:org/projects/:project/synthesis/pages` returning `{ pages: Array<{ slug, category, title, sources, updated_at }> }` (no content). Requires valid user auth (org membership).

#### Scenario: Lists all pages for project
- **WHEN** project has 14 synthesis pages
- **THEN** response contains array of 14 objects with slug, category, title (no content field)

#### Scenario: Empty project returns empty array
- **WHEN** project has no synthesis pages
- **THEN** response is `{ pages: [] }`
