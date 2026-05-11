## ADDED Requirements

### Requirement: fabrick-analyze skill generates wiki pages in .fabrick/wiki/

The `fabrick-analyze` skill (running inside an LLM session) SHALL produce markdown wiki pages in `.fabrick/wiki/` organized by concept taxonomy. It uses `fabrick scan` CLI for change detection, LLM reads code and writes pages directly, then `fabrick rebuild-source-map` CLI rebuilds metadata. Each page SHALL have YAML frontmatter with: `slug`, `category`, `sources` (array of source file paths), `related` (array of related page slugs), `updated` (date). Page content is LLM-generated markdown.

#### Scenario: Full analysis of a NestJS app
- **WHEN** `fabrick-analyze` skill runs on a NestJS app with no previous wiki
- **THEN** `.fabrick/wiki/` contains `index.md`, `hashmap.json`, `source-map.json`, and pages in category directories (entities/, logic/, contracts/, transport/, config/, or LLM-chosen)

#### Scenario: Each page has valid frontmatter
- **GIVEN** wiki generation completed
- **WHEN** any `.md` page in `.fabrick/wiki/` is read
- **THEN** it has YAML frontmatter with slug, category, sources (non-empty array), related (array), updated (date string)

### Requirement: index.md contains TOC with 1-line summaries

`index.md` SHALL list all wiki pages grouped by category, with each entry being a relative link and a 1-line description. This file serves as navigation map for LLMs and humans.

#### Scenario: Index reflects all pages
- **GIVEN** wiki has 8 pages across 3 categories
- **WHEN** `index.md` is read
- **THEN** all 8 pages appear as links with summaries, grouped under their category headings

### Requirement: Incremental update only regenerates affected pages

When `hashmap.json` exists from a previous run, `fabrick scan` detects changed files, the LLM reads `source-map.json` to resolve affected wiki pages, reads only those files and pages, and updates them. Unchanged pages are not touched.

#### Scenario: One file changed, two pages updated
- **GIVEN** previous wiki with 10 pages, `src/models/user.ts` changed
- **AND** source-map maps `src/models/user.ts` to `["entities/user", "logic/auth-flow"]`
- **WHEN** `fabrick-analyze` skill runs
- **THEN** LLM receives only `src/models/user.ts` content + current `entities/user.md` + current `logic/auth-flow.md` + `index.md`
- **AND** only those 2 pages + index.md are rewritten

#### Scenario: No changes detected
- **GIVEN** no file hashes changed since last run
- **WHEN** `fabrick-analyze` skill runs `fabrick scan`
- **THEN** scan returns empty diff, skill skips wiki generation, reports "wiki is up to date"

### Requirement: LLM outputs JSON, parsed into wiki files

The LLM SHALL output structured JSON (not markdown with delimiters). For full mode: array of page objects. For incremental mode: object with `upsert` (pages to create/update), `delete` (slugs to remove), `index` (updated index content).

#### Scenario: Full mode JSON parsed into files
- **WHEN** LLM returns JSON array with 8 page objects
- **THEN** 8 `.md` files are written to appropriate category directories with frontmatter derived from JSON fields

#### Scenario: Incremental mode deletes removed pages
- **WHEN** LLM returns `{ "delete": ["entities/old-thing"] }`
- **THEN** `entities/old-thing.md` is removed from `.fabrick/wiki/`

### Requirement: Monorepo produces per-app wikis

In a monorepo, the LLM (via fabrick-analyze skill) SHALL detect apps by inspecting file paths from `fabrick scan` output and looking for monorepo indicators (nx.json, turbo.json, multiple package.json under apps/ or packages/). The LLM generates an independent wiki per app at `apps/<app-name>/.fabrick/wiki/` and runs `fabrick rebuild-source-map --wiki-path` per app.

#### Scenario: Monorepo with 3 apps
- **GIVEN** monorepo with `apps/api/`, `apps/frontend/`, `apps/worker/`
- **WHEN** fabrick-analyze skill runs
- **THEN** LLM detects monorepo structure from file paths
- **AND** each app gets its own `.fabrick/wiki/` with independent hashmap.json, source-map.json, index.md
- **AND** `fabrick rebuild-source-map` is called per app wiki

### Requirement: Taxonomy has starter set plus LLM freedom

The LLM prompt SHALL suggest starter categories: entities/, logic/, contracts/, transport/, config/. The LLM MAY create additional categories if the codebase warrants it (e.g. middleware/, auth/, integrations/).

#### Scenario: LLM adds custom category
- **GIVEN** app has significant middleware code
- **WHEN** LLM generates wiki
- **THEN** a `middleware/` category may appear with relevant pages, and index.md reflects it
