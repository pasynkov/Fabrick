## ADDED Requirements

### Requirement: SearchImplV2 performs an agentic tool-use loop over compendium and dossier repositories

`SearchImplV2.search(projectId, question, apiKey, opts?)` SHALL execute an agentic search loop using the Anthropic Messages API tool-use protocol. It SHALL load the project's compendium index page via `CompendiumRepository.findIndex(projectId)`. It SHALL build an initial message stack consisting of (a) a system prompt describing the agent role, listing tool descriptions, and specifying the qualified-source `SOURCES:` format, (b) a user message containing the index page content, and (c) a user message containing the question. The system prompt and the index user message SHALL be marked with `cache_control: { type: 'ephemeral' }`. It SHALL call `messages.create` with the v2 tool set and iterate until the model returns `stop_reason: 'end_turn'` or a budget cap is reached. It SHALL return `{ answer, reasoning?, sources, metrics, promptRevisionId }`.

#### Scenario: Successful search with single dossier read
- **WHEN** `search` is called with `projectId`, `question`, and `apiKey`
- **AND** the model issues one `dossier_read({repo_slug, scope, slug})` call and then emits `end_turn` with a final message ending in `SOURCES: dossier/<repo_slug>/<scope>/<slug>`
- **THEN** `SearchImplV2` returns `{ answer, sources: ['dossier/<repo_slug>/<scope>/<slug>'], ... }` with the `SOURCES:` line removed from `answer`

#### Scenario: Multi-hop traversal across compendium and dossier
- **WHEN** the model calls `compendium_read('transport-graph')`, then `list_scopes('backend-api')`, then `dossier_read_pages([...])`, and finally emits `end_turn` with a `SOURCES:` line listing all qualified slugs it consulted
- **THEN** every tool call is dispatched against the injected repositories
- **AND** the returned `sources` matches the `SOURCES:` line, in the order the model emits

#### Scenario: No compendium index page
- **WHEN** `search` is called but `CompendiumRepository.findIndex(projectId)` returns `null`
- **THEN** `SearchImplV2` throws an error indicating no compendium index found
- **AND** no Anthropic call is made

#### Scenario: Model emits final answer without SOURCES line
- **WHEN** the model returns `stop_reason: 'end_turn'` with no trailing `SOURCES:` line
- **THEN** `SearchImplV2` returns `answer` unchanged with the BRIEF/REASONING markers stripped
- **AND** `sources` is the set of qualified slugs read via `compendium_read`, `dossier_read`, and `dossier_read_pages` during the loop, in first-read order
- **AND** a warning is logged

#### Scenario: Budget exhausted mid-loop
- **WHEN** the iteration count reaches `maxIters` or total tokens exceed `maxTotalTokens` after a tool-use turn
- **THEN** `SearchImplV2` makes one final `messages.create` call with `tool_choice: { type: 'none' }` asking the model to finalize using only what has been read
- **AND** the returned `metrics.stopReason` is `'budget'`

### Requirement: SearchImplV2 exposes a fixed 5-tool surface to the model

`SearchImplV2` SHALL register the following tools with `messages.create` and SHALL execute them against the injected `CompendiumRepository` and `DossierRepository`:

- `compendium_read(slug: string)` → `{ ok: true, slug, content }` or `{ ok: false, error }`
- `list_scopes(repo_slug: string)` → `{ ok: true, scopes: Array<{scope, page_count}> }` or `{ ok: false, error }`
- `list_in_scope(repo_slug: string, scope: string)` → `{ ok: true, pages: Array<{slug, title, one_liner}> }` or `{ ok: false, error }`
- `dossier_read(repo_slug: string, scope: string, slug: string)` → `{ ok: true, repo_slug, scope, slug, content }` or `{ ok: false, error }`
- `dossier_read_pages(refs: Array<{repo_slug, scope, slug}>)` → `{ ok: true, pages: Array<{repo_slug, scope, slug, content}>, missing: Array<{...}> }` or `{ ok: false, error }`. The `refs` array MUST contain at least one entry and at most 6 entries.

It SHALL NOT expose `list_categories`, `list_in`, `page_meta`, `read_related`, or any other v1 tool.

#### Scenario: compendium_read rejects the index slug
- **WHEN** the model calls `compendium_read('index')`
- **THEN** the tool result is `{ ok: false, error: 'index is already provided in the bootstrap; use the other compendium slugs' }`
- **AND** the loop continues without counting a page-read

#### Scenario: compendium_read accepts the four topic slugs
- **WHEN** the model calls `compendium_read(slug)` for any of `system`, `data-flows`, `transport-graph`, `infra`
- **AND** `CompendiumRepository.findBySlug(projectId, slug)` returns a page
- **THEN** the tool result is `{ ok: true, slug, content }`
- **AND** the qualified source `compendium/<slug>` is added to the engine's read-set

#### Scenario: dossier_read_pages enforces batch limit
- **WHEN** the model calls `dossier_read_pages` with 7 refs
- **THEN** the tool result is `{ ok: false, error: 'dossier_read_pages accepts at most 6 refs per call (got 7)' }`

#### Scenario: dossier_read against unknown repo_slug
- **WHEN** the model calls `dossier_read({repo_slug: 'unknown', scope: 'x', slug: 'service'})`
- **AND** `DossierRepository.findPage` returns `null`
- **THEN** the tool result is `{ ok: false, error: 'page not found: dossier/unknown/x/service' }`

### Requirement: SearchImplV2 returns qualified source references

`SearchImplV2` SHALL parse the model's final answer and SHALL recognize `SOURCES: <qualified-slug>, <qualified-slug>, ...` as the canonical source-reference line, where a qualified slug matches one of:
- `compendium/<slug>` with `slug` in `{system, data-flows, transport-graph, infra}`
- `dossier/<repo_slug>/<scope>/<slug>` with non-empty path segments

`compendium/index` SHALL NOT appear in returned sources even if the model emits it.

When the answer body contains `BRIEF:` and optional `REASONING:` markers, `SearchImplV2` SHALL split the body into `answer` (text between `BRIEF:` and `REASONING:` or `SOURCES:`) and `reasoning` (text between `REASONING:` and `SOURCES:`).

#### Scenario: Qualified sources parsed correctly
- **WHEN** the model emits a final message containing `SOURCES: compendium/system, dossier/backend-api/web/service`
- **THEN** `sources` is `['compendium/system', 'dossier/backend-api/web/service']`

#### Scenario: compendium/index is stripped from sources
- **WHEN** the model emits `SOURCES: compendium/index, dossier/cli/cmd/service`
- **THEN** `sources` is `['dossier/cli/cmd/service']`

#### Scenario: BRIEF and REASONING markers split the answer
- **WHEN** the final answer is `BRIEF:\nShort answer.\nREASONING:\nLong rationale.\nSOURCES: compendium/system`
- **THEN** `answer` is `Short answer.`
- **AND** `reasoning` is `Long rationale.`
- **AND** `sources` is `['compendium/system']`

### Requirement: CompendiumRepository abstraction

The `shared/src/v2-search/CompendiumRepository` interface SHALL declare:
- `findIndex(projectId: string): Promise<{ slug: string; content: string } | null>` returning the compendium page with `slug === 'index'`
- `findBySlug(projectId: string, slug: string): Promise<{ slug: string; content: string } | null>` returning any compendium page

The TypeORM implementation in `applications/backend/api/src/v2/search/typeorm-compendium-search.repository.ts` SHALL read from the existing `compendium_pages` table without modification. The filesystem implementation in `applications/backend/sandbox/src/fs-compendium.repository.ts` SHALL read each `.md` file under `sandbox-data/compendium/` with the filename (sans `.md`) as the slug.

#### Scenario: TypeORM repo returns null when index slug missing
- **WHEN** `findIndex('project-1')` runs against a `compendium_pages` table with rows for `system` and `data-flows` but no `index`
- **THEN** the result is `null`

#### Scenario: Filesystem repo parses frontmatter title
- **WHEN** `sandbox-data/compendium/system.md` starts with a YAML frontmatter block containing `title: System overview`
- **AND** `findBySlug('sandbox', 'system')` is called
- **THEN** the returned page's `content` is the raw file content (frontmatter included)

### Requirement: DossierRepository abstraction

The `shared/src/v2-search/DossierRepository` interface SHALL declare:
- `listScopes(projectId: string, repoSlug: string): Promise<Array<{ scope: string; pageCount: number }>>`
- `listInScope(projectId: string, repoSlug: string, scope: string): Promise<Array<{ slug: string; title: string; oneLiner: string }>>`
- `findPage(projectId: string, repoSlug: string, scope: string, slug: string): Promise<{ repoSlug: string; scope: string; slug: string; content: string } | null>`
- `findPages(projectId: string, refs: Array<{ repoSlug: string; scope: string; slug: string }>): Promise<Array<{ repoSlug: string; scope: string; slug: string; content: string }>>`

The TypeORM implementation in `applications/backend/api/src/v2/search/typeorm-dossier-search.repository.ts` SHALL join `dossier_pages` with the existing `repositories` table on `repository.id = dossier_pages.repoId AND repository.projectId = :projectId`, treating `repository.slug` as the `repoSlug`. It SHALL NOT expose `repoId` outside the repository class.

The filesystem implementation in `applications/backend/sandbox/src/fs-dossier.repository.ts` SHALL walk `sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md` and derive `(repoSlug, scope, slug)` from the path segments.

#### Scenario: listScopes returns distinct scopes with counts
- **WHEN** `dossier_pages` for `repoSlug='backend-api'` contains pages with scopes `web` (4 pages) and `worker` (4 pages)
- **AND** `listScopes('p1', 'backend-api')` is called
- **THEN** the result is `[{ scope: 'web', pageCount: 4 }, { scope: 'worker', pageCount: 4 }]`

#### Scenario: listInScope returns slug, title, and one-liner
- **WHEN** `listInScope('p1', 'backend-api', 'web')` is called
- **AND** the page `(backend-api, web, service)` has title `Web service` and content starting with `# Web service\n\nServes HTTP traffic.`
- **THEN** the result includes `{ slug: 'service', title: 'Web service', oneLiner: 'Serves HTTP traffic.' }`

#### Scenario: findPages returns only existing rows
- **WHEN** `findPages('p1', [{repoSlug:'a', scope:'x', slug:'service'}, {repoSlug:'a', scope:'x', slug:'missing'}])` is called
- **AND** only the first ref exists
- **THEN** the returned array has one element for `(a, x, service)`

#### Scenario: Filesystem repo treats top-level subdir as scope
- **WHEN** `sandbox-data/dossiers/backend-api/web/service.md` exists
- **AND** `findPage('sandbox', 'backend-api', 'web', 'service')` is called
- **THEN** the returned page has `repoSlug='backend-api'`, `scope='web'`, `slug='service'`, and `content` equal to the file body

### Requirement: API exposes POST /v2/projects/:id/search

`applications/backend/api/src/v2/search/SearchControllerV2` SHALL expose `POST /v2/projects/:id/search` accepting `{ question: string, reasoning?: boolean }` and returning `{ answer: string, reasoning?: string, sources: string[] }`. The endpoint SHALL be protected by `FabrickAuthGuard`. It SHALL resolve the project by id, enforce that the authenticated user is a member of the project's organization, resolve the Anthropic API key via `ApiKeyResolutionService.resolveForProject`, invoke `SearchImplV2.search`, persist a `search_requests` row and per-call `token_usage` rows via the existing repositories with `operation='search'`, and return the response.

#### Scenario: Authenticated member can search
- **WHEN** an authenticated user who is an org member of project `p1` calls `POST /v2/projects/p1/search` with `{ question: 'where is auth?' }`
- **AND** the project has an Anthropic API key resolved
- **THEN** the response is `{ answer, sources }` (with `reasoning` omitted when not requested)
- **AND** a `search_requests` row is persisted with `projectId='p1'`, `operation='search'`, and metrics from `SearchImplV2`

#### Scenario: Missing API key
- **WHEN** the user calls `POST /v2/projects/p1/search` and `ApiKeyResolutionService.resolveForProject(p1)` returns no key
- **THEN** the endpoint responds with `400` and a message indicating no Anthropic API key is configured

#### Scenario: Non-member access
- **WHEN** an authenticated user who is not a member of the project's org calls `POST /v2/projects/p1/search`
- **THEN** the endpoint responds with `404 Project not found`

#### Scenario: No compendium index throws BadRequest
- **WHEN** `SearchImplV2` throws an error indicating no compendium index found
- **THEN** the endpoint responds with `400` and a message indicating compendium synthesis must be run first

### Requirement: Compendium synthesis worker writes 5 slugs including LLM-written index

`applications/backend/synthesis/src/synthesis/compendium-event.handler.ts` SHALL produce five compendium pages per regen: `system`, `data-flows`, `transport-graph`, `infra`, and `index`. The Sonnet regen-compute call SHALL be instructed to write the `index` page as a table-of-contents page containing (a) a `## Topics` section listing the four topic slugs with one-line descriptions, and (b) a `## Repositories` section listing each repository in the project's `repos` bundle field with `slug`, `name`, one-paragraph description, and a bulleted list of its scopes.

The Haiku description call SHALL diff only the four topic slugs (`system`, `data-flows`, `transport-graph`, `infra`); the `index` slug SHALL NOT be included in the description diff.

The `parseTopicBodies` parser SHALL accept all five slugs without modification beyond the slug list extension.

#### Scenario: Five slugs persisted after regen
- **WHEN** a compendium regen completes
- **AND** the callback finalizes
- **THEN** `compendium_pages` for the project contains rows for `system`, `data-flows`, `transport-graph`, `infra`, and `index`

#### Scenario: Index contains topics and repositories sections
- **WHEN** the bundle's `repos` field is `[{slug: 'backend-api', name: 'Backend API', scopes: ['web', 'worker']}]`
- **AND** the synthesis worker writes the `index` page
- **THEN** the `index` body contains a `## Topics` heading with bullets linking `system`, `data-flows`, `transport-graph`, `infra`
- **AND** contains a `## Repositories` heading with a `backend-api` entry listing scopes `web` and `worker`

#### Scenario: Haiku description ignores the index slug
- **WHEN** the description diff is built
- **THEN** the prompt input only references the four topic slugs

### Requirement: Compendium bundle carries repos+scopes context

`applications/backend/api/src/v2/compendium/services/compendium-bundle.service.ts` SHALL include a `repos: Array<{ slug: string; name: string; scopes: string[] }>` field in the bundle JSON it uploads to Azure Blob storage. The field SHALL be populated by joining the project's `repositories` table with `dossier_pages` and aggregating distinct `scope` values per `repoId`.

#### Scenario: repos field reflects current dossier state
- **WHEN** the bundle is built for a project with two repositories `backend-api` (scopes: `web`, `worker`) and `cli` (scopes: `cmd`)
- **THEN** the bundle's `repos` field is `[{slug:'backend-api', name:..., scopes:['web','worker']}, {slug:'cli', name:..., scopes:['cmd']}]`

#### Scenario: Repo with no dossier pages still appears
- **WHEN** a project has a repository row with no dossier pages yet
- **THEN** the bundle's `repos` field includes the repo with `scopes: []`

### Requirement: Sandbox exposes v2 fs repositories and synthesize-v2 endpoint

The sandbox app SHALL add the following without modifying existing v1 endpoints or `FsWikiRepository`:

- `FsCompendiumRepository` implementing `CompendiumRepository` over `sandbox-data/compendium/<slug>.md` files.
- `FsDossierRepository` implementing `DossierRepository` over `sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md` files. A repo whose `.fabrick/wiki/` directory has no scope subdirectories (flat layout) SHALL be materialized as scope `root`.
- `POST /sandbox/synthesize-v2` accepting `{ repos?: string[] }`. For each repo path resolved from the body, the `REPOS` env, or the blobs dir (same priority as v1), the endpoint SHALL copy `<repo>/.fabrick/wiki/<scope-dir>/<slug>.md` files into `sandbox-data/dossiers/<repoSlug>/<scope-dir>/<slug>.md` verbatim, then build an in-memory bundle and call `claude-sonnet-4-6` once to produce the 5 compendium slugs in `## TOPIC: <slug>` format, then write each parsed body into `sandbox-data/compendium/<slug>.md`. It SHALL respond `{ pages: 5, status: 'done', repos: [<slug>, ...] }`.
- `POST /v2/orgs/:org/projects/:project/search` accepting `{ question: string, reasoning?: boolean }` and returning `{ answer: string, reasoning?: string, sources: string[] }`. The endpoint SHALL invoke `SearchImplV2` with `projectId='sandbox'`. It SHALL NOT require authentication.

#### Scenario: synthesize-v2 copies dossier files
- **WHEN** `POST /sandbox/synthesize-v2` runs against a repo at `/tmp/repo-a` with `.fabrick/wiki/web/service.md`
- **THEN** `sandbox-data/dossiers/repo-a/web/service.md` exists with identical bytes

#### Scenario: synthesize-v2 produces 5 compendium pages
- **WHEN** `POST /sandbox/synthesize-v2` completes successfully
- **THEN** `sandbox-data/compendium/` contains exactly `system.md`, `data-flows.md`, `transport-graph.md`, `infra.md`, `index.md`

#### Scenario: Flat repo wiki maps to scope 'root'
- **WHEN** the repo's `.fabrick/wiki/` contains `service.md` directly (no subdir)
- **THEN** the copied file is `sandbox-data/dossiers/<repoSlug>/root/service.md`

#### Scenario: synthesize-v2 fails when ANTHROPIC_API_KEY is missing
- **WHEN** `POST /sandbox/synthesize-v2` runs without `ANTHROPIC_API_KEY` set
- **THEN** the response is `400` with a message indicating the env var is required

#### Scenario: Sandbox v2 search responds without auth
- **WHEN** `POST /v2/orgs/demo/projects/demo/search` is called without a Bearer token
- **AND** `sandbox-data/compendium/index.md` exists
- **THEN** the response is `{ answer, sources }`

#### Scenario: v1 endpoints continue to work
- **WHEN** the sandbox is running
- **AND** clients call `POST /sandbox/synthesize`, `POST /orgs/:org/projects/:project/search`, or `POST /repos/:repoId/context`
- **THEN** the v1 behavior is unchanged
