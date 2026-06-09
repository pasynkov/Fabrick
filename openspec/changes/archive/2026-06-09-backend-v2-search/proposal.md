## Why

The v1 search loop targets the legacy `wiki_pages` table and a flat `index` slug. The recent v2 event-sourced dossier + compendium schema (archived change `backend-event-sourced-dossier-compendium`) splits documentation into a per-project `compendium_pages` table (4 fixed topic slugs) and a per-repo `dossier_pages` table (scope+slug hierarchy). The v1 search engine cannot read this shape: there is no project-level `index` page, no `category` column for `list_categories` / `list_in`, and no first-class repo/scope axis for drill-down. A new search engine is needed that bootstraps from compendium, drills into per-repo dossiers, and reports sources qualified by repo and scope. The sandbox app must be updated alongside so the local developer flow continues to work against the new schema.

## What Changes

- Introduce a new `backend-v2-search` capability that owns the v2 search engine, repository abstractions, HTTP endpoint, and analytics persistence. v1 `SearchImpl`, `WikiRepository`, and `POST /orgs/:org/projects/:project/search` are left untouched and remain available.
- Add a new `SearchImplV2` in `applications/backend/shared/src/v2-search/` with two new repository interfaces: `CompendiumRepository` and `DossierRepository`. The engine bootstraps the model with the `compendium/index` page only and exposes a 5-tool surface: `compendium_read`, `list_scopes`, `list_in_scope`, `dossier_read`, `dossier_read_pages`. The `read_related` / `page_meta` / `list_categories` / `list_in` tools from v1 are NOT carried forward; the v2 entities have no `related` field and no `category` column.
- Add `POST /v2/projects/:id/search` in `applications/backend/api/src/v2/search/` that resolves the project, looks up the Anthropic API key via `ApiKeyResolutionService`, invokes `SearchImplV2`, and persists analytics rows via the existing `SearchRequestRepository` and `TokenUsageRepository`. Auth via existing `FabrickAuthGuard`.
- Extend the compendium synthesis worker (`applications/backend/synthesis/src/synthesis/compendium-event.handler.ts`) so it produces a 5-slug compendium: `index`, `system`, `data-flows`, `transport-graph`, `infra`. The `index` slug is LLM-written and contains a table of contents for the four topics plus a per-repository section describing each repo (slug, name, one-paragraph description) and listing its scopes.
- Extend the compendium bundle (`applications/backend/api/src/v2/compendium/services/compendium-bundle.service.ts`) to carry per-repo context (`{slug, name, scopes: [...]}`) so the synthesis worker can write the index without extra round-trips.
- Add v2 sandbox surface in `applications/backend/sandbox/`: new `FsCompendiumRepository` and `FsDossierRepository` reading from `sandbox-data/compendium/` and `sandbox-data/dossiers/<repoSlug>/<scope>/`; new `POST /sandbox/synthesize-v2` that walks the `REPOS` env paths, copies `.fabrick/wiki/<scope>/<slug>.md` files into the dossier directory, and runs a single Sonnet call to produce the 5 compendium pages; new `POST /v2/orgs/:org/projects/:project/search` endpoint that calls `SearchImplV2`. The existing v1 sandbox endpoints (`/sandbox/synthesize`, `/orgs/:org/projects/:project/search`, `/repos/:repoId/context`) and `FsWikiRepository` remain unchanged.
- Source references in v2 final answers use qualified slugs: `compendium/<slug>` for compendium pages, `dossier/<repoSlug>/<scope>/<slug>` for dossier pages. The trailing `SOURCES:` line carries this format.

## ADR Alignment

This change follows ADR-001 in shape: per-app scope detection (D3), the 4-slug taxonomy `service/contracts/config/integrations` (D4), inline markdown links as evidence with no `sources`/`related` frontmatter (D6, D9), and the synthesis-as-business-narrative model (D7).

Two deliberate deviations from ADR-001:

- **D10 (LLM never writes index)**: ADR-001 specifies that index pages are deterministic breadcrumbs assembled by the CLI/API from each topic's `description` frontmatter, never sent to or written by the LLM. This change writes the compendium `index` slug via the synthesis worker LLM call instead, so the index can carry per-repository descriptions and scope listings that are not directly derivable from topic frontmatter. The repo description requirement (raised by the consumer of `list_repos`-style information during search) is the driver. The 4 topic pages remain LLM-written exactly as before; only the `index` slug joins them.
- **D8 (synthesis pages — 4 topics, not more)**: ADR-001 caps synthesis at four topic pages to limit paraphrase-drift surfaces. This change adds a fifth slug `index`. `index` is a meta-page (TOC + repo+scope catalog), not a fifth topic, so the drift concern does not apply — the index does not contain operational facts, only links and one-line descriptions that the model regenerates each pass.

## Capabilities

### New Capabilities

- `backend-v2-search`: v2 LLM-driven search loop over `compendium_pages` + `dossier_pages`, qualified source-reference format, repository abstractions in `shared/src/v2-search/`, the new `POST /v2/projects/:id/search` endpoint, the compendium worker's `index` slug, the bundle's repo+scope context extension, and the v2 sandbox surface (fs repositories, `synthesize-v2`, sandbox `v2/search`).

### Modified Capabilities

None. The compendium synthesis worker and bundle are touched by this change, but their requirements live inside the (currently archived) `backend-event-sourced-dossier-compendium` change and have not been promoted to a published spec. The behavior added here (the `index` slug and repo context) is captured as part of the new `backend-v2-search` capability.

## Impact

- **Code**: new `applications/backend/shared/src/v2-search/` module; new `applications/backend/api/src/v2/search/` module; new fs repositories and controller endpoints in `applications/backend/sandbox/src/`; modified compendium synthesis handler + bundle service to add the `index` slug and repo context.
- **Database**: none. Existing `compendium_pages` and `dossier_pages` tables already store the columns the v2 search needs (slug, title, content, frontmatter). No migration.
- **Auth**: existing `FabrickAuthGuard` (JWT) for the new API endpoint. Sandbox endpoints remain unauthenticated as today.
- **LLM cost**: bootstrap shrinks (only index page embedded vs all topic pages); drill-down via tools pays per-call cost. Net cost is comparable to v1 for typical questions; compendium synthesis adds one LLM call's worth of tokens per regen (4 topic slugs → 5).
- **Analytics**: `search_requests` and `token_usage` rows continue to be written via the existing repositories; `operation: 'search'` is reused.
- **CLI**: no changes in this proposal. CLI is not part of this change.
- **Frontend**: no changes. The v1 search endpoint and console search UI continue to work against v1 data.
