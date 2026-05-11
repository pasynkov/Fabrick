## MODIFIED Requirements

### Requirement: Synthesis prompt produces concept-centric wiki pages instead of repo-centric files

The synthesis worker prompt SHALL instruct the LLM to produce wiki pages organized by concept taxonomy (entities, logic, contracts, transport, config, overview) instead of by repository (apps/repo-name.md, cross-cutting/). Each page SHALL have YAML frontmatter with slug, category, title, sources (repo slugs), and related (page slugs). Output format SHALL use `=== PAGE: slug ===` delimiters (not `=== FILE: path ===`).

#### Scenario: Two repos with shared User entity
- **GIVEN** repo-A wiki has `entities/user.md` describing User model with fields id, email, name
- **AND** repo-B wiki has `entities/user.md` describing User DTO with fields id, email, displayName
- **WHEN** project synthesis runs
- **THEN** project wiki contains one `entities/user` page that merges both perspectives — model fields, DTO shape, which repo owns what
- **AND** page frontmatter has `sources: [repo-a, repo-b]`

#### Scenario: Cross-repo flow discovered
- **GIVEN** repo-A wiki has `logic/checkout.md` describing checkout flow ending with "publishes OrderCreated event"
- **AND** repo-B wiki has `transport/events.md` describing "subscribes to OrderCreated event"
- **WHEN** project synthesis runs
- **THEN** project wiki contains a `flows/order-processing` page (or similar) linking checkout in repo-A to event handling in repo-B
- **AND** Related Pages section links to relevant entity and contract pages

#### Scenario: Output format uses PAGE delimiters with frontmatter
- **WHEN** synthesis LLM generates output
- **THEN** each page is separated by `=== PAGE: {slug} ===`
- **AND** each page starts with YAML frontmatter block:
  ```
  ---
  slug: entities/user
  category: entities
  title: User
  sources: [backend, frontend]
  related: [entities/order, logic/auth-flow]
  ---
  ```
- **AND** markdown content follows the frontmatter

#### Scenario: Index page always included
- **WHEN** synthesis completes
- **THEN** output includes a page with `slug: index`
- **AND** index lists all other pages grouped by category with 1-line summary each

### Requirement: Synthesis prompt includes taxonomy guidelines

The prompt SHALL define starter categories and their purpose:
- `entities/` — domain models, data structures, database schemas that appear across repos
- `logic/` — business flows, algorithms, cross-repo processes
- `contracts/` — API endpoints, request/response schemas, shared interfaces
- `transport/` — messaging topics/events, gRPC services, WebSocket channels
- `config/` — environment variables grouped by concern, shared configuration
- `overview` — system-level summary, architecture diagram description

The LLM MAY create additional categories if the project warrants it.

#### Scenario: LLM creates custom category
- **GIVEN** multiple repos have significant authentication middleware
- **WHEN** synthesis runs
- **THEN** LLM may create an `auth/` category with dedicated pages
- **AND** index reflects the new category

### Requirement: Each page has Related Pages section

Every wiki page (except index) SHALL end with a `## Related Pages` section containing links to other pages in the project wiki with brief relationship descriptions.

#### Scenario: Entity page links to flows and contracts
- **GIVEN** project wiki has entities/user, logic/auth-flow, contracts/rest-api
- **WHEN** entities/user page is generated
- **THEN** Related Pages section includes links like:
  - `[Auth Flow](../logic/auth-flow.md) — login/register uses User entity`
  - `[REST API](../contracts/rest-api.md) — /users endpoints expose User data`

## ADDED Requirements

### Requirement: Synthesis input is repo wiki pages, not raw context

The synthesis worker SHALL read repo wiki `.md` files from blob storage (`*/wiki/**/*.md`) instead of raw context files (`*/context/*`). Input format changes from `--- meta.yaml ---` / `--- endpoints.yaml ---` sections to full wiki pages per repo.

#### Scenario: Worker loads repo wikis
- **GIVEN** blob storage has `org/project/backend/wiki/index.md`, `org/project/backend/wiki/entities/user.md`, etc.
- **WHEN** synthesis worker builds input
- **THEN** it loads all `.md` files from each repo's wiki/ prefix
- **AND** formats as: `=== REPO: backend ===\n{all pages concatenated}`

#### Scenario: Repo wiki not yet uploaded
- **GIVEN** project has 3 repos but only 2 have uploaded wikis
- **WHEN** synthesis runs
- **THEN** synthesis uses only the 2 available repo wikis
- **AND** resulting project wiki reflects only those repos

### Requirement: Incremental project wiki synthesis

When existing project wiki pages are present in the database, synthesis SHALL operate incrementally:
1. Load existing project wiki pages from DB
2. Determine which repo wikis changed since last synthesis (compare with stored repo wiki hashes or content)
3. Send to LLM: existing project pages + changed repo wiki pages + unchanged repo wiki index pages (for cross-reference context)
4. LLM updates only affected project pages, creates new ones if needed

#### Scenario: One repo wiki changed out of three
- **GIVEN** project has 3 repos, project wiki has 20 pages
- **AND** only repo-B wiki was re-uploaded with changes
- **WHEN** synthesis runs
- **THEN** LLM receives: all 20 existing project pages + full repo-B wiki + index.md from repo-A and repo-C (for context)
- **AND** LLM updates only project pages that had `sources` including `repo-b`, plus any new cross-repo pages
- **AND** unchanged pages are preserved as-is

#### Scenario: First synthesis for a project (no existing pages)
- **GIVEN** project has no pages in wiki_pages table
- **WHEN** synthesis runs
- **THEN** worker detects no existing pages → sends all repo wikis to LLM for full generation
- **AND** all generated pages are inserted into DB

#### Scenario: Repo removed from project
- **GIVEN** project wiki has pages sourced from repo-C
- **AND** repo-C is removed from the project
- **WHEN** synthesis runs
- **THEN** LLM is instructed that repo-C no longer exists
- **AND** pages solely sourced from repo-C are removed
- **AND** pages sourced from multiple repos (including repo-C) are updated to remove repo-C content

### Requirement: Synthesis worker tracks repo wiki versions

The worker SHALL store or compare repo wiki content to detect which repos actually changed. This can be done via:
- Hash of concatenated repo wiki content stored alongside project wiki pages
- Or comparison of uploaded blob timestamps
- Or explicit "changed repos" flag in the synthesis job message

#### Scenario: Re-synthesis with no repo changes
- **GIVEN** synthesis triggered but no repo wikis changed since last run
- **WHEN** worker detects no changes
- **THEN** worker skips LLM call, reports status as done with no updates

### Requirement: Synthesis prompt handles incremental mode explicitly

The prompt SHALL have two modes:

**Full mode** (no existing project pages):
- Input: all repo wikis
- Instruction: generate complete project wiki from scratch
- Output: all pages

**Incremental mode** (existing project pages present):
- Input: existing project pages + changed repo wikis + unchanged repo index pages
- Instruction: update affected pages, preserve unchanged pages (do not output them), create new pages if new concepts found, mark pages for deletion if source content removed
- Output: only changed/new pages + a special `=== DELETE: slug ===` marker for pages to remove + updated index page

#### Scenario: Incremental output with deletions
- **WHEN** LLM determines page `entities/old-thing` should be removed
- **THEN** output includes `=== DELETE: entities/old-thing ===` (no content needed)
- **AND** worker deletes that row from wiki_pages table

#### Scenario: Incremental output preserves unchanged pages
- **GIVEN** 20 existing project pages, 3 affected by repo-B changes
- **WHEN** LLM generates incremental output
- **THEN** output contains only ~3-5 updated pages + index (not all 20)
- **AND** worker upserts only the output pages, leaves others untouched
