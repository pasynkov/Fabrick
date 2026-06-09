## 1. Shared v2-search layer (TDD)

- [ ] 1.1 Create `applications/backend/shared/src/v2-search/` directory with `index.ts` barrel export
- [ ] 1.2 Define `CompendiumRepository` interface (`findIndex`, `findBySlug`) and `CompendiumPage` data type in `compendium-repository.interface.ts`
- [ ] 1.3 Define `DossierRepository` interface (`listScopes`, `listInScope`, `findPage`, `findPages`) and `DossierPageRef`/`DossierPage` data types in `dossier-repository.interface.ts`
- [ ] 1.4 Write `parseFinalAnswerV2` unit tests covering BRIEF/REASONING split, qualified-source parsing (`compendium/<slug>`, `dossier/<repo>/<scope>/<slug>`), `compendium/index` stripping, and the no-`SOURCES:` fallback
- [ ] 1.5 Implement `parseFinalAnswerV2` until tests pass
- [ ] 1.6 Write `SearchImplV2` unit tests with mocked Anthropic client and stub repositories covering: single-tool happy path, multi-hop traversal, no-index error, budget-exhaust finalization, `compendium_read('index')` rejection, `dossier_read_pages` 7-ref rejection, missing dossier page
- [ ] 1.7 Implement `SearchImplV2.search` and the 5 tool dispatchers until tests pass
- [ ] 1.8 Add `SHARED_SEARCH_V2_PROVIDERS` export and register the impl in `SharedModule.for(...)` extension matching the existing v1 wiring style

## 2. Backend API v2 search endpoint (TDD)

- [ ] 2.1 Create `applications/backend/api/src/v2/search/search.module.ts` skeleton (imports the v2-search shared providers, registers TypeORM entities `CompendiumPage`, `DossierPage`, `Repository`)
- [ ] 2.2 Write integration test for `TypeOrmCompendiumSearchRepository` covering `findIndex` returns null when no index row, `findBySlug` returns the row for each of the four topics
- [ ] 2.3 Implement `typeorm-compendium-search.repository.ts` until tests pass
- [ ] 2.4 Write integration test for `TypeOrmDossierSearchRepository` covering `listScopes` returns distinct scopes with counts via the `repositories` join, `listInScope` returns slug/title/oneLiner, `findPage` translates `repoSlug` → `repoId` via join, `findPages` returns only existing rows
- [ ] 2.5 Implement `typeorm-dossier-search.repository.ts` until tests pass
- [ ] 2.6 Write e2e test for `POST /v2/projects/:id/search`: authenticated member success path, missing API key returns 400, non-member returns 404, missing compendium index returns 400, persists one `search_requests` row + N `token_usage` rows with `operation='search'`
- [ ] 2.7 Implement `search.controller.ts` and `search.service.v2.ts` (resolution + auth + analytics persistence) until tests pass
- [ ] 2.8 Wire `SearchModuleV2` into `v2.module.ts`

## 3. Compendium synthesis worker — add index slug (TDD)

- [ ] 3.1 Write unit test for `parseTopicBodies` with the 5-slug list — covers parsing `## TOPIC: index` alongside the four existing topics
- [ ] 3.2 Extend `topicSlugs` to `['system', 'data-flows', 'transport-graph', 'infra', 'index']` in `compendium-event.handler.ts`; update regen prompt to instruct the model on the index page format (Topics + Repositories sections)
- [ ] 3.3 Write unit test verifying the Haiku description input only references the four topic slugs (no `index`)
- [ ] 3.4 Update `diffText` construction to iterate only the four topic slugs; keep index out of the description prompt
- [ ] 3.5 Update `finalPages` assembly so index is included with `sources: []`, `related: []`, derived title from frontmatter
- [ ] 3.6 Re-run the worker's existing processor spec to confirm 5-slug end-to-end shape

## 4. Compendium bundle — add repos+scopes context (TDD)

- [ ] 4.1 Write unit test for `CompendiumBundleService` asserting the bundle JSON contains `repos: [{slug, name, scopes: []}]` even when a repo has no dossier pages
- [ ] 4.2 Write unit test asserting `repos[i].scopes` lists distinct scopes from `dossier_pages` for that repo
- [ ] 4.3 Update `CompendiumBundleService.build(...)` to populate the `repos` field via a SQL aggregate joining `repositories` and `dossier_pages`
- [ ] 4.4 Confirm the bundle SHA256 contract still holds (bundle JSON is deterministic for fixed inputs)

## 5. Sandbox v2 surface (TDD)

- [ ] 5.1 Write `FsCompendiumRepository` unit tests: `findIndex` returns null when `sandbox-data/compendium/index.md` absent; `findBySlug` reads each file under `sandbox-data/compendium/`
- [ ] 5.2 Implement `fs-compendium.repository.ts` until tests pass
- [ ] 5.3 Write `FsDossierRepository` unit tests: walks `sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md` correctly; treats flat `.fabrick/wiki/` (no subdir) as scope `root` during read; `listScopes` and `listInScope` return correct shape; `findPages` skips missing
- [ ] 5.4 Implement `fs-dossier.repository.ts` until tests pass
- [ ] 5.5 Write e2e test for `POST /sandbox/synthesize-v2`: fails without `ANTHROPIC_API_KEY`; copies `<repo>/.fabrick/wiki/<scope>/<slug>.md` files into `sandbox-data/dossiers/<repoSlug>/<scope>/<slug>.md`; flat repo maps to scope `root`; produces exactly five `sandbox-data/compendium/*.md` files
- [ ] 5.6 Extract a small `synthesize-compendium-bundle.ts` helper invoked by both the worker handler and the sandbox endpoint to avoid duplicating the Sonnet prompt body (worker keeps the 3-step path; sandbox calls only the regen-compute step)
- [ ] 5.7 Implement `POST /sandbox/synthesize-v2` until tests pass
- [ ] 5.8 Write e2e test for `POST /v2/orgs/:org/projects/:project/search`: works without auth header; returns 400 when `sandbox-data/compendium/index.md` is missing; returns `{ answer, sources }` on success (with the Anthropic client stubbed)
- [ ] 5.9 Implement `POST /v2/orgs/:org/projects/:project/search` and wire `SearchImplV2` + fs repositories into `SandboxModule`
- [ ] 5.10 Verify v1 endpoints (`/sandbox/synthesize`, `/orgs/:org/projects/:project/search`, `/repos/:repoId/context`, `/projects/:projectId`, `/orgs/:org/projects/:project/synthesis/file`) still pass their existing tests untouched

## 6. Prompt revisions

- [ ] 6.1 Add `applications/backend/sandbox/prompts/search/claude/v2/prompt.md` containing the v2 system prompt (role, 5-tool descriptions, `SOURCES:` qualified format, BRIEF/REASONING markers)
- [ ] 6.2 Update `FilePromptRepository` registration to serve the v2 revision for `('search', 'claude')` when `SearchImplV2` requests it (introduce a `kind='search-v2'` variant OR a sub-folder convention — decide during implementation and document in the file header)
- [ ] 6.3 Add a corresponding DB-prompt seed migration entry if prod prompts live in the DB; otherwise skip and document

## 7. Validation

- [ ] 7.1 `npm test --workspaces` passes from `applications/backend/`
- [ ] 7.2 `npm run lint --workspaces` passes
- [ ] 7.3 Manual smoke: run sandbox with `--repos <local repo with .fabrick/wiki/>`; call `POST /sandbox/synthesize-v2`; confirm 5 compendium pages on disk; call `POST /v2/orgs/demo/projects/demo/search` with a real question; confirm qualified sources in the response
- [ ] 7.4 Manual smoke against a dev API: trigger a compendium regen end-to-end; confirm `compendium_pages` has the `index` row and that `POST /v2/projects/:id/search` answers with qualified `dossier/...` sources
- [ ] 7.5 `openspec validate backend-v2-search` returns clean
