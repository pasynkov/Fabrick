## 1. WikiRepository metadata projections

- [x] 1.1 Extend `WikiRepository` interface in `applications/backend/shared/src/wiki-repository.interface.ts` with `findCategories(projectId): Promise<string[]>` and `findByCategory(projectId, category): Promise<Array<{ slug: string; title: string; one_liner: string }>>`.
- [x] 1.2 Implement `findCategories` in `TypeOrmWikiRepository` using `SELECT DISTINCT category`.
- [x] 1.3 Implement `findByCategory` in `TypeOrmWikiRepository` selecting only `slug`, `title`, and projecting `one_liner` from the leading non-empty line of `content` after the title heading.
- [x] 1.4 Implement `findCategories` and `findByCategory` in `FsWikiRepository` (sandbox) by scanning the on-disk wiki tree.
- [x] 1.5 Update any other `WikiRepository` implementations (HTTP, mocks in tests) to satisfy the interface.

## 2. SearchImpl agentic loop skeleton

- [x] 2.1 Replace the body of `SearchImpl.search()` in `applications/backend/shared/src/search/search.impl.ts` with an agentic loop scaffold (no tools yet) that returns a placeholder while the rest is wired up.
- [x] 2.2 Define a `SearchBudget` type with `maxIters`, `maxPagesRead`, `maxTotalTokens` and defaults (8 / 12 / 50000); make values overridable via constructor or env.
- [x] 2.3 Build the initial message stack: cached system block (agent role + tool descriptions + worked examples), cached user message with the project's `index` page content, user message with the question.
- [x] 2.4 Throw the existing "No wiki pages found" error when the `index` page is missing.

## 3. Tool definitions and dispatch

- [x] 3.1 Declare tool schemas (`list_categories`, `list_in`, `page_meta`, `read_page`, `read_pages`, `read_related`) matching the shared-search-impl spec.
- [x] 3.2 Implement a `toolDispatch` function that maps each tool name to a `WikiRepository` call and returns the documented JSON shape.
- [x] 3.3 Enforce `read_pages` max batch size of 6; return an `error` tool result on overflow.
- [x] 3.4 Implement `read_related` using `WikiPage.related[]` for `depth = 1`; reject `depth > 2` with an error tool result.
- [x] 3.5 Return `{ ok: false, error: "page not found: <slug>" }` for unknown slugs in `read_page`/`read_pages`/`read_related`.

## 4. Loop control and budgets

- [x] 4.1 Implement the main loop: call `messages.create` with `tools` + cache breakpoints, dispatch on `stop_reason`.
- [x] 4.2 Track per-iteration counters: iteration count, pages read (cumulative), total tokens (`usage.input_tokens + usage.output_tokens`).
- [x] 4.3 On `tool_use`, execute tools, append assistant message + user `tool_result` blocks, continue.
- [x] 4.4 On `end_turn`, extract the final text, parse a trailing `SOURCES: <slug>, <slug>, ...` line if present, strip it from `answer`.
- [x] 4.5 On `max_tokens` or any cap hit, append the partial-finalize user message and make one final `messages.create` call, then parse as in 4.4.
- [x] 4.6 When `maxPagesRead` is reached, force subsequent content-tool calls to return an error result rather than executing.
- [x] 4.7 Fall back to "slugs read during the loop" when the model omits the `SOURCES:` line; log a warning.

## 5. Prompt caching

- [x] 5.1 Add `cache_control: { type: 'ephemeral' }` to the system block.
- [x] 5.2 Add `cache_control: { type: 'ephemeral' }` to the index user message block.
- [x] 5.3 Verify no cache breakpoints leak onto the question message or per-iteration `tool_use`/`tool_result` blocks.

## 6. Wiring and DI

- [x] 6.1 Keep `@Inject(WIKI_REPOSITORY)` constructor injection unchanged.
- [x] 6.2 Confirm `SharedModule` registration of `SearchImpl` is still correct (no new providers needed).
- [x] 6.3 Ensure the API search service continues to call `SearchImpl.search()` and returns `{ answer, sources }` unchanged.

## 7. Logging

- [x] 7.1 Log start of search with `projectId` and a redacted question prefix.
- [x] 7.2 Per-iteration log: iter number, tool name + args, page count read, tokens used.
- [x] 7.3 Log final stop reason, total iterations, total pages read, total tokens, returned slug count.

## 8. Tests

- [x] 8.1 Unit test: tool dispatch — each tool name maps to the right `WikiRepository` call and shapes its return value.
- [x] 8.2 Unit test: `read_pages` batch overflow returns an error result.
- [x] 8.3 Unit test: `SOURCES:` line is stripped from `answer` and parsed into `sources`.
- [x] 8.4 Unit test: missing `SOURCES:` line — falls back to "slugs read during loop" and warns.
- [x] 8.5 Integration test: loop with a mocked Anthropic client driving a `tool_use` → `tool_result` → `end_turn` sequence; verify final `{ answer, sources }`.
- [x] 8.6 Integration test: `maxIters` cap triggers partial finalization.
- [x] 8.7 Integration test: `maxPagesRead` cap blocks further content tools while letting the loop converge.
- [x] 8.8 Integration test: `maxTotalTokens` cap triggers partial finalization.
- [x] 8.9 Integration test: missing `index` page throws and does not call Anthropic.
- [x] 8.10 Repository test: `findCategories` returns distinct categories; `findByCategory` returns metadata-only entries with `one_liner`.

## 9. Verification

- [x] 9.1 Run shared package tests; all green.
- [x] 9.2 Run API search end-to-end against the sandbox with the FS-backed repo and verify response shape `{ answer, sources }`.
- [ ] 9.3 Run API search end-to-end against a Postgres-backed project and verify response shape `{ answer, sources }`. _(deferred — needs live Postgres project + Anthropic key; tracked outside change)_
- [x] 9.4 `openspec validate add-agentic-search --strict` passes.
