## 1. Shared package: PromptRepository boundary

- [x] 1.1 Create `applications/backend/shared/src/prompt-repository.interface.ts` exporting the `PromptRepository` interface, the `PromptRecord` type (`{ id, name, agent, revision, content: { files: Record<string, string> } }`), and the `PROMPT_REPOSITORY` DI token (Symbol).
- [x] 1.2 Add a Jest contract test suite that any `PromptRepository` implementation must pass (latest selection across multiple revisions, not-found rejection).
- [x] 1.3 Update `applications/backend/shared/src/index.ts` to re-export `PromptRepository`, `PromptRecord`, and `PROMPT_REPOSITORY`.

## 2. Shared package: SearchImpl + SynthesisImpl wiring

- [x] 2.1 Modify `applications/backend/shared/src/search/search.impl.ts`: add `PROMPT_REPOSITORY` constructor injection, delete the in-file `SYSTEM_PROMPT` constant, call `promptRepo.getLatest('search', 'claude')` at the start of `search()`, use `record.content.files['prompt.md']` for the system block, include `promptRevisionId` in the returned object, update the `SearchResult` type accordingly.
- [x] 2.2 Update `SearchImpl` unit tests: mock `PromptRepository`, assert `getLatest` is called once per `search()`, assert `promptRevisionId` is propagated, assert that a `getLatest` rejection bubbles up unchanged.
- [x] 2.3 Modify `applications/backend/shared/src/synthesis/synthesis.impl.ts`: add `PROMPT_REPOSITORY` constructor injection, call `promptRepo.getLatest('synthesis', 'claude')` inside `synthesize()`, use `record.content.files['prompt.md']` for the system block, return `{ rawResponse, promptRevisionId }`.
- [x] 2.4 Delete `applications/backend/shared/src/synthesis/synthesis-prompt.ts` and remove the `SYNTHESIS_SYSTEM_PROMPT` re-export from `applications/backend/shared/src/index.ts`.
- [x] 2.5 Update `SynthesisImpl` unit tests: mock `PromptRepository`, assert `getLatest` call and that the returned `promptRevisionId` is the mocked id, assert error propagation on missing prompt.
- [x] 2.6 Replace `SharedModule.forRepository(wikiProvider)` with `SharedModule.for({ wiki, prompt }: { wiki: Provider; prompt: Provider })` in `applications/backend/shared/src/shared.module.ts`, registering both providers and exporting `SearchImpl` and `SynthesisImpl`.

## 3. api: prompt_revisions schema + entity + repository

- [x] 3.1 Create `applications/backend/api/src/entities/prompt-revision.entity.ts` mapping the new table with columns `id`, `name`, `agent`, `revision`, `content` (jsonb), `note`, `createdBy`, `createdAt`.
- [x] 3.2 Register the entity in `applications/backend/api/src/migrations/index.ts` exports list and in the TypeORM entities array of `app.module.ts`.
- [x] 3.3 Write migration `applications/backend/api/src/migrations/<ts>-AddPromptRevisions.ts` that creates the table with a `UNIQUE (name, agent, revision)` constraint and a `(name, agent, revision DESC)` index.
- [x] 3.4 Create `applications/backend/api/src/prompts/db-prompt.repository.ts` implementing `PromptRepository` over the entity (single ordered `LIMIT 1` query, throws with `(name, agent)` in the message on no row).
- [x] 3.5 Create `applications/backend/api/src/prompts/prompts.module.ts` providing `DbPromptRepository` under the `PROMPT_REPOSITORY` token and exporting it.
- [x] 3.6 Write `DbPromptRepository` integration test against the real Postgres instance used by `api-testing` to verify latest-revision selection and not-found behavior.

## 4. api: seed migration

- [x] 4.1 Write migration `applications/backend/api/src/migrations/<ts>-SeedPromptRevisions.ts` that captures, as in-migration TypeScript string constants, the current bodies of:
  - the `SYSTEM_PROMPT` from `search.impl.ts` (assigned to `content.files['prompt.md']` of `search/claude/1`)
  - the `SYNTHESIS_SYSTEM_PROMPT` from `synthesis-prompt.ts` (assigned to `content.files['prompt.md']` of `synthesis/claude/1`)
  - `applications/cli/src/skills/fabrick-analyze/SKILL.md` and `applications/cli/src/skills/fabrick-analyze/patterns.md` (assigned to `content.files['SKILL.md']` and `content.files['patterns.md']` of `fabrick-analyze/claude/1`)
  - `applications/cli/src/skills/fabrick-push/SKILL.md` (assigned to `content.files['SKILL.md']` of `fabrick-push/claude/1`)
- [x] 4.2 Use `INSERT ... ON CONFLICT (name, agent, revision) DO NOTHING` so repeated runs are idempotent and admin-created higher revisions are not affected.
- [x] 4.3 Integration test: run the seed twice against a fresh schema; assert four rows after the first run and exactly the same four after the second.

## 5. api: analytics columns

- [x] 5.1 Write migration `applications/backend/api/src/migrations/<ts>-AddPromptRevisionIdToAnalytics.ts` adding nullable `prompt_revision_id uuid` columns to `search_requests` and `token_usage`, each with `FOREIGN KEY ... REFERENCES prompt_revisions(id) ON DELETE SET NULL`.
- [x] 5.2 Add `promptRevisionId: string | null` to `applications/backend/api/src/entities/search-request.entity.ts` and `token-usage.entity.ts` with the matching `@ManyToOne(() => PromptRevision, { onDelete: 'SET NULL', nullable: true })` relations.
- [x] 5.3 Update `applications/backend/api/src/search/search.service.ts` so that the `searchRequests` repository write includes the `promptRevisionId` returned by `SearchImpl.search()`.
- [x] 5.4 Update `applications/backend/api/src/synthesis/synthesis.service.ts` (and anywhere it writes `token_usage` rows attributable to a synthesis call) so each row carries the `promptRevisionId` returned by `SynthesisImpl.synthesize()`.
- [x] 5.5 Update `TokenUsageRepository` and `SearchRequestRepository` constructors/methods if they typecheck the inserted shape, to accept the new field.
- [ ] 5.6 Service-level tests: assert `prompt_revision_id` is populated on the persisted row and equals the id returned by the impl mock.

## 6. api: admin endpoints

- [x] 6.1 Create `applications/backend/api/src/prompts/prompts.controller.ts` mounted at the `prompts` path under the `/v1/admin` prefix, guarded by the existing PlatformAdmin guard.
- [x] 6.2 Implement `GET /v1/admin/prompts` (list of latest per `(name, agent)` with `revision`, `updatedAt`, `note`) using a single `DISTINCT ON` or window-function query.
- [x] 6.3 Implement `GET /v1/admin/prompts/:name/:agent` returning the full latest row including `content`.
- [x] 6.4 Implement `GET /v1/admin/prompts/:name/:agent/history` returning every revision newest-first without `content`.
- [x] 6.5 Implement `GET /v1/admin/prompts/:name/:agent/:revision` returning the full row for that revision.
- [x] 6.6 Implement `POST /v1/admin/prompts/:name/:agent` with class-validator DTO `{ files: Record<string, string>, note?: string }`, rejecting empty `files`, computing `MAX(revision)+1` and inserting in a single transaction, returning `201 { id, revision }`. Set `createdBy` to the caller's user id from the auth guard context.
- [x] 6.7 e2e tests (under `applications/backend/api/test/`): unauthenticated → 401, non-admin → 403, list/detail/history/specific/POST happy paths, POST with invalid body → 400, POST for a brand-new `(name, agent)` starts at revision 1.

## 7. api: skills zip dynamic build

- [x] 7.1 Rewrite `applications/backend/api/src/skills/skills.controller.ts` so that `GET /skills/claude` no longer serves the static asset. Inject `DbPromptRepository` (or a dedicated method on it) to fetch the latest revision of every `(name LIKE 'fabrick-%', agent='claude')` pair.
- [x] 7.2 Implement a helper `injectSkillVersion(body: string, revision: number): string` that finds the leading `---\n...\n---` frontmatter block and either replaces the existing `version:` line with `version: 1.<revision>` or inserts that line at the end of the block. No-op if the body does not start with `---`.
- [x] 7.3 Stream the assembled zip using the existing zip-building library already in use by the api (do not introduce a new dependency); each prompt becomes a directory named after `name`, with files from `content.files`.
- [x] 7.4 Delete `applications/backend/api/src/assets/claude-skills.zip` and any build step that produces it.
- [x] 7.5 Update existing `skills-distribution` e2e tests to assert: directories named after each `fabrick-*` prompt, `SKILL.md` contains `version: 1.<rev>`, `patterns.md` is byte-identical to stored content, frontmatter-rewrite handles the "no version line" and "existing version line" cases.

## 8. api: module wiring

- [x] 8.1 Update `applications/backend/api/src/app.module.ts` to register `PromptsModule` and to wire `SharedModule.for({ wiki: <existing TypeOrmWikiRepository provider>, prompt: { provide: PROMPT_REPOSITORY, useExisting: DbPromptRepository } })`.
- [x] 8.2 Make sure `SearchModule` and `SynthesisModule` import `SharedModule` (the new form) so `SearchImpl` and `SynthesisImpl` are constructible with both repos injected.

## 9. sandbox: FilePromptRepository

- [x] 9.1 Create `applications/backend/sandbox/src/file-prompt.repository.ts` implementing `PromptRepository` by reading from a `prompts/` directory next to the existing sandbox wiki fixtures. Layout: `prompts/<name>/<agent>/<files...>`. `revision: 1`. `id = sha256(name+'\n'+agent+'\n'+canonicalJson(files)).slice(0,32)` formatted as a UUID v4 string.
- [x] 9.2 Commit `applications/backend/sandbox/prompts/search/claude/prompt.md`, `applications/backend/sandbox/prompts/synthesis/claude/prompt.md`, `applications/backend/sandbox/prompts/fabrick-analyze/claude/SKILL.md`, `applications/backend/sandbox/prompts/fabrick-analyze/claude/patterns.md`, and `applications/backend/sandbox/prompts/fabrick-push/claude/SKILL.md` with copies of the current prompt content at the moment of this change.
- [x] 9.3 Wire `applications/backend/sandbox/src/sandbox.module.ts` to use `SharedModule.for({ wiki: <existing FsWikiRepository provider>, prompt: { provide: PROMPT_REPOSITORY, useClass: FilePromptRepository } })`.
- [ ] 9.4 Unit test `FilePromptRepository`: reads search prompt from FS returns `revision: 1` and `content.files['prompt.md']` equal to the file body; reads `fabrick-analyze` returns both files; `id` is stable across calls.
- [ ] 9.5 Smoke test the sandbox controller flow end-to-end (search + synthesize) using `FilePromptRepository` to confirm no Postgres dependency is introduced for prompt reads.

## 10. admin console: Prompts section

- [ ] 10.1 Add a `Prompts` nav item to the admin console layout, visible only when the current user has the PlatformAdmin role.
- [ ] 10.2 Implement the list view at `/prompts`: fetch `GET /v1/admin/prompts`, render a table with columns name, agent, current revision, updated at, last editor.
- [ ] 10.3 Implement the detail view at `/prompts/:name/:agent`: fetch the latest revision and render a JSON editor pre-populated with the `content.files` object (single textarea or a JSON editor component already used elsewhere in the console). A Save button calls `POST /v1/admin/prompts/:name/:agent` with `{ files, note }`; on `201` refetch and display the new revision number.
- [ ] 10.4 Validate JSON client-side before enabling Save; show a parse-error message inline.
- [ ] 10.5 Implement the history tab inside the detail view: fetch `GET /v1/admin/prompts/:name/:agent/history`, list every revision newest first; clicking a row fetches `GET /v1/admin/prompts/:name/:agent/:revision` and renders the `content.files` object in a read-only JSON viewer.
- [ ] 10.6 Component tests for list, edit-save, history navigation, and the JSON-validation guard.

## 11. End-to-end verification

- [x] 11.1 Run all migrations against a fresh DB and assert the four seed rows exist with `revision: 1`.
- [x] 11.2 Hit `GET /skills/claude` and verify the served `SKILL.md` files carry `version: 1.1`.
- [x] 11.3 POST a new revision of `fabrick-analyze/claude` via the admin API; hit `/skills/claude` again and verify the served `SKILL.md` body and `version: 1.2` reflect the edit.
- [ ] 11.4 Issue a search via the api; confirm the persisted `search_requests` row carries `prompt_revision_id` equal to the latest `search/claude` row's `id`.
- [ ] 11.5 Issue a synthesis via the api; confirm the persisted `token_usage` rows carry `prompt_revision_id` equal to the latest `synthesis/claude` row's `id`.
- [ ] 11.6 Boot the sandbox app, perform a search, and confirm it succeeds without any DB connection for prompt reads.
- [x] 11.7 `npm run build` from the workspace root succeeds; no references remain to `SYNTHESIS_SYSTEM_PROMPT`, the in-file `SYSTEM_PROMPT` constant, or `applications/backend/api/src/assets/claude-skills.zip`.
