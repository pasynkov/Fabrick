## Context

The v1 search stack (shared `SearchImpl`, `WikiRepository`, `POST /orgs/:org/projects/:project/search`) is built around a single `wiki_pages` table with `category`/`slug`/`content`/`related`/`sources` columns, an `index` slug, and tools shaped around that schema (`list_categories`, `list_in`, `read_related`, `page_meta`).

The v2 event-sourced backend (archived change `backend-event-sourced-dossier-compendium`) introduced two new tables on top of `project_events`:

- `compendium_pages` — per-project, exactly four LLM-written slugs today: `system`, `data-flows`, `transport-graph`, `infra`. No `index`, no `category`.
- `dossier_pages` — per-repository, unique on `(repoId, scope, slug)`. Populated by the CLI push (out of scope here) with the ADR-001 4-slug taxonomy (`service`, `contracts`, `config`, `integrations`) per scope-dir.

Both tables keep `sources: string[]` and `related: string[]` columns, but the synthesis worker writes them empty and ADR-001 (D6) defines evidence as inline markdown links, not frontmatter fields.

The sandbox app today runs the v1 synthesis path against an in-process `FsWikiRepository` writing flat markdown into `sandbox-data/pages/*.md`. It exposes the v1 search endpoint shape. There is no v2 storage layout in the sandbox.

## Goals / Non-Goals

**Goals:**

- Stand up a v2 search engine over `compendium_pages` + `dossier_pages` without touching the v1 stack.
- Give the LLM enough bootstrap context (compendium `index` page) to navigate the project without a `list_repos` tool — repo descriptions live inside the index.
- Qualify final-answer source references by repo and scope so the frontend can resolve any slug unambiguously.
- Keep the sandbox usable as a local-only target for v2 search by adding parallel fs repositories and a simplified `synthesize-v2` endpoint.
- Preserve the v1 sandbox endpoints, v1 prod endpoints, and `FsWikiRepository` exactly as they are — no breaking changes.

**Non-Goals:**

- CLI changes. The CLI continues to push the v1 zip to the sandbox and the v2 dossier-events stream to prod; the dossier-events push contract is the archived change's domain.
- Removing the v1 search stack. v1 lives side-by-side as long as v1 wiki pages still exist.
- Adding the queue / Azure Blob / callback round-trip to the sandbox synthesis path. Sandbox runs a single synchronous Sonnet call instead.
- Re-implementing or wrapping the v1 `SearchImpl` to share code with v2. The engines stay separate.
- Adding a database migration. The existing `compendium_pages` and `dossier_pages` schemas already carry every column the v2 search needs.

## Decisions

### D1. Two independent search engines (no shared base)

`shared/src/v2-search/search-impl.ts` is a fresh class with its own tool set, own repository abstractions, and own loop state. The v1 `SearchImpl` is not touched and not refactored into a base class.

Rationale: v1 and v2 differ in tool surface (5 of 6 tools change), bootstrap shape (no index in v1 catch-up, full index in v2), and source-reference format. A shared base would have to express both shapes through configuration; the configuration surface ends up larger than the duplicated code. Two small classes are cheaper to read and evolve.

Alternative considered: parametrize `SearchImpl` with pluggable `Toolset` and `Bootstrap` strategies. Rejected — adds a layer of indirection and forces v1's working code to take on v2's concepts.

### D2. Two repository interfaces, no unified `WikiRepository`

`CompendiumRepository` and `DossierRepository` live in `shared/src/v2-search/` next to `SearchImplV2`. Each repository covers exactly one table; there is no abstraction that hides whether a page is a compendium topic or a dossier slug.

```
CompendiumRepository
  findIndex(projectId): Promise<CompendiumPage | null>
  findBySlug(projectId, slug): Promise<CompendiumPage | null>

DossierRepository
  listScopes(projectId, repoSlug): Promise<{scope: string, pageCount: number}[]>
  listInScope(projectId, repoSlug, scope): Promise<{slug, title, oneLiner}[]>
  findPage(projectId, repoSlug, scope, slug): Promise<DossierPage | null>
  findPages(projectId, refs: {repoSlug,scope,slug}[]): Promise<DossierPage[]>
```

Rationale: the two stores have different identity (project vs (repo, scope)), different content models, and different read patterns. A unified `WikiRepository` would either leak repo/scope into the compendium path (awkward) or force the engine to discriminate at every call site (no gain).

The TypeORM implementations live under `applications/backend/api/src/v2/search/` next to the controller. The fs implementations live under `applications/backend/sandbox/src/`.

### D3. Repo identity in search is the `Repository.slug`, not `Repository.id`

`DossierPage.repoId` is a UUID. All v2-search tool inputs and source references use the human-readable `Repository.slug` (e.g. `backend-api`) instead. The TypeORM `DossierRepository` joins `Repository` to translate slug → id at the SQL boundary; everything above that boundary speaks slugs.

Rationale: the LLM emits sources as text; UUIDs are unusable in `SOURCES: dossier/<uuid>/<scope>/<slug>` because the frontend would need an extra resolution step to render them. Slugs are stable, readable, and already enforced unique within a project.

The fs implementation reads the slug directly from the directory name (`sandbox-data/dossiers/<repoSlug>/...`).

### D4. Bootstrap = compendium index only (with cache_control: ephemeral)

The LLM gets:

1. System prompt describing role + tool surface + `SOURCES:` format. Cached.
2. User message: full body of `compendium/index`. Cached.
3. User message: the question.

Compendium topic pages (`system`, `data-flows`, `transport-graph`, `infra`) are NOT pre-embedded. The model fetches them via `compendium_read(slug)` if it judges they help.

Rationale: with the index already containing a TOC of all four topics plus a per-repo + per-scope catalog, most questions can be answered by jumping straight to the right dossier slug. Pre-embedding all four topic pages would inflate every search by ~10–20k tokens for the majority of questions that never need them. Cache breakpoints amortize the index across consecutive queries.

### D5. Tool surface — 5 tools

```
compendium_read(slug: string)
  → { ok: true, slug, content } | { ok: false, error }
  slug ∈ {system, data-flows, transport-graph, infra}

list_scopes(repo_slug: string)
  → { ok: true, scopes: [{scope, page_count}] } | { ok: false, error }

list_in_scope(repo_slug: string, scope: string)
  → { ok: true, pages: [{slug, title, one_liner}] } | { ok: false, error }

dossier_read(repo_slug: string, scope: string, slug: string)
  → { ok: true, repo_slug, scope, slug, content } | { ok: false, error }

dossier_read_pages(refs: [{repo_slug, scope, slug}])
  → { ok: true, pages: [...], missing: [...] } | { ok: false, error }
  max 6 refs per call
```

The v1 `read_related`, `page_meta`, `list_categories`, `list_in` tools are NOT carried forward:

- `read_related`: v2 entities have no `related` field; ADR D6 mandates inline markdown links. The LLM follows links by reading their slugs and issuing a new `dossier_read`.
- `page_meta`: redundant — `list_in_scope` already returns `{slug, title, one_liner}`.
- `list_categories` / `list_in`: there is no `category` column on either v2 table. Scope+repo replace categories.

A `compendium_read('index')` call is rejected with an `ok: false` error — the index is already in the bootstrap. This prevents the model from wasting a tool call to re-read it.

### D6. Budget — same shape as v1, fresh defaults

Identical budget object as v1 (`maxIters`, `maxPagesRead`, `maxTotalTokens`), but defaults are read from new env vars: `FABRICK_SEARCH_V2_MAX_ITERS` (default 8), `FABRICK_SEARCH_V2_MAX_PAGES_READ` (default 12), `FABRICK_SEARCH_V2_MAX_TOTAL_TOKENS` (default 50_000). `MAX_READ_PAGES_BATCH = 6`. `SEARCH_MODEL = 'claude-sonnet-4-6'`. `PER_CALL_MAX_TOKENS = 4096`.

Rationale: separate env vars so we can tune v2 in production without affecting v1 traffic during the overlap period.

### D7. Final-answer format — qualified sources

```
BRIEF:
<paragraph>

REASONING:
<optional>

SOURCES: <qualified-slug>, <qualified-slug>, ...
```

Qualified slug grammar:

- `compendium/<slug>` for compendium topic reads (`system`, `data-flows`, `transport-graph`, `infra`)
- `dossier/<repo_slug>/<scope>/<slug>` for dossier reads

`compendium/index` is intentionally never reported even though the index seeded the bootstrap — it always sources every answer and adds no signal.

Fallback (no `SOURCES:` line): the engine emits the union of every qualified slug it read during the loop, in tool-call order. Same fallback policy as v1.

### D8. `SearchImplV2.search()` signature mirrors v1

```ts
search(
  projectId: string,
  question: string,
  apiKey: string,
  opts?: { reasoning?: boolean },
): Promise<SearchResultV2>
```

`SearchResultV2` carries the same `answer`, optional `reasoning`, `sources`, `metrics`, `promptRevisionId` shape as v1's `SearchResult`. This lets the v2 controller reuse `SearchRequestRepository` and `TokenUsageRepository` without entity changes.

The `promptRevisionId` is fetched the same way as v1 — `PROMPT_REPOSITORY` keyed by `('search', 'claude')`. The actual prompt content is a separate revision file written under `applications/backend/sandbox/prompts/search/claude/v2/prompt.md` (sandbox) and registered in the DB-backed prompt repository (prod). We keep `kind='search'` for analytics continuity and version the v2 prompt by introducing a new revision; the model only needs to differ in tool descriptions and the qualified-source instruction.

### D9. Compendium synthesis worker — add `index` as 5th slug

`applications/backend/synthesis/src/synthesis/compendium-event.handler.ts`:

- `topicSlugs` becomes `['system', 'data-flows', 'transport-graph', 'infra', 'index']`.
- The Sonnet regen-compute prompt is extended with an explicit `## TOPIC: index` instruction: write a table-of-contents page with a "Topics" section linking the four topic slugs (one-line description per topic) and a "Repositories" section listing each repo with `slug`, `name`, one-paragraph description, and a bullet list of its scopes (scope name + one-line summary).
- `parseTopicBodies` already iterates the slug array — no parser change needed beyond list extension.
- Haiku description (D5 in ADR-001's section on Haiku description) continues to compare only the four topic slugs against the diff input; the index slug is omitted from the description call to avoid noise.

### D10. Compendium bundle carries repo+scope context

`applications/backend/api/src/v2/compendium/services/compendium-bundle.service.ts`:

- Extend the bundle JSON with a `repos: [{slug, name, scopes: string[]}]` field, fetched by joining `Repository` with `DossierPage` and aggregating distinct scopes per repo for the project.
- The synthesis worker reads this section when rendering the `index` page. Without it, the LLM would have to invent repo metadata from dossier content alone.

The bundle shape is internal to the API↔worker contract; no public schema change.

### D11. Sandbox v2 surface — additive, no v1 changes

```
applications/backend/sandbox/
  sandbox-data/
    pages/                          ← v1, untouched
    compendium/<slug>.md            ← v2, new
    dossiers/<repoSlug>/<scope>/<slug>.md
  src/
    fs-wiki.repository.ts           ← v1, untouched
    fs-compendium.repository.ts     ← new
    fs-dossier.repository.ts        ← new
    sandbox.controller.ts           ← extended (new endpoints, old ones unchanged)
    sandbox.module.ts               ← extended (new providers, new sub-imports)
```

The `FsCompendiumRepository` parses YAML frontmatter from each `.md` file under `sandbox-data/compendium/` (slug derived from filename). The `FsDossierRepository` walks `sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md` and parses the same way. Both implement the new shared interfaces.

New endpoints:

- `POST /sandbox/synthesize-v2` — body `{ repos?: string[] }`. Same source-priority rules as v1 (`repos` → `REPOS` env → blobs). For each repo path:
  - Scan `<repo>/.fabrick/wiki/<scope-dir>/<slug>.md` for the ADR-001 4-slug taxonomy plus `index.md` (ignored in v2 sandbox).
  - Copy each `<slug>.md` into `sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md` verbatim, preserving frontmatter.
  - After all dossiers written, build an in-memory bundle `{ projectId: 'sandbox', repos: [{slug, name, scopes}], currentDossiers: {<repoSlug>: {scopes: {<scope>: {<slug>: content}}}}, currentCompendium: null|<existing> }` and run one Sonnet `claude-sonnet-4-6` call producing the 5 compendium slugs in the same `## TOPIC: <slug>` format the worker expects. Parse with the same `parseTopicBodies` shape and write into `sandbox-data/compendium/<slug>.md`.
  - No queue, no callback, no JWT, no Azure Blob. Errors are surfaced as `BadRequestException` to the developer.
- `POST /v2/orgs/:org/projects/:project/search` — body `{ question: string, reasoning?: boolean }`. Delegates to `SearchImplV2` with `projectId='sandbox'`. Returns `{ answer, sources, reasoning? }`. No auth.

Existing v1 endpoints (`/sandbox/synthesize`, `/orgs/:org/projects/:project/search`, `/repos/:repoId/context`, `/projects/:projectId`, `/orgs/:org/projects/:project/synthesis/file`) are unchanged.

### D12. Analytics — reuse v1 entities, `operation='search'`

`SearchRequestRepository` and `TokenUsageRepository` are reused as-is for the v2 controller. The `operation` column stays `'search'`. The `searchRequestId` foreign key on `token_usage` is unchanged.

Rationale: queries that aggregate search cost across v1+v2 traffic just work. There is no need for a separate `'search-v2'` operation value during the overlap.

A new column distinguishing v1 vs v2 would be the right call once v1 is removed; that's a follow-up cleanup.

## Risks / Trade-offs

- **Index page becomes a drift surface (against ADR D8)** → Mitigation: the index is regenerated from scratch every compendium cycle (no patch-apply path for it), so paraphrase drift cannot compound. The index never contains operational facts — only links and one-liner descriptions — so a paraphrase mismatch between two cycles does not introduce contradictions.
- **Bootstrap is undersized for projects with many repos/scopes** → Mitigation: the index can grow without re-architecting; if it ever crosses the 25–30k token comfort range we add a paginated `list_scopes(repo_slug)` already in the tool surface, and the bootstrap can also be split into a separate cached system block.
- **`compendium/index` falls out of sync with topic slugs if a topic regen partially fails** → Mitigation: the worker writes all five slugs in one atomic upsert (existing transaction in `CompendiumPagesRepository.upsertAll`); a partial write returns the bundle to its previous state.
- **Sandbox synthesize-v2 duplicates worker logic** → Mitigation: the sandbox call is intentionally a simplified single-Sonnet-call path; it does not implement the patch / regen / haiku-description three-step pipeline. Sandbox is a local toy; cost optimization there is not a goal. The simplification is documented in the controller.
- **Sandbox dossier copy preserves frontmatter that may carry stale `sha`/`updatedAt`** → Mitigation: the sandbox does not depend on those fields. The fs repository reads `title`, `slug`, content body, and a derived one-liner; the rest of the frontmatter is ignored. Documented in `FsDossierRepository`.
- **`SOURCES: dossier/<repo_slug>/<scope>/<slug>` ambiguity if a repo is later renamed** → Mitigation: out of scope. Repo slug renames are a project-management concern; the search response is a point-in-time artifact.

## Migration Plan

No data migration. The change is additive at every layer:

- Code: new modules and files, all under `v2/` or new sub-trees.
- DB: no schema changes.
- Deploy: a single PR enables the new endpoint behind the same `FabrickAuthGuard`. There is no feature flag — clients call the new endpoint when ready.
- Rollback: revert the PR. v1 stack is untouched.

The first compendium regen after rollout will include the `index` slug; in-flight bundles created before the rollout will lack `repos` context and produce an empty index section (handled gracefully — the LLM is instructed to omit empty sections).

## Open Questions

- Should the sandbox `synthesize-v2` skip dossier copy when the `.fabrick/wiki/<scope-dir>/` layout uses a flat (non-subdir) structure? Decision: treat any flat repo as a single scope named `root`. Captured in tasks.
- Do we keep `FABRICK_SEARCH_*` env vars (v1 budget) when v1 is eventually removed, or alias the v2 vars onto them? Out of scope here; revisit when v1 is removed.
