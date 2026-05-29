## 1. Database schema

- [ ] 1.1 Add `SearchRequest` TypeORM entity with `id`, `projectId`, `question`, `reasoningRequested`, `iters`, `pagesRead`, `totalInputTokens`, `totalOutputTokens`, `durationMs`, `stopReason`, `answerBrief`, `answerReasoning` (nullable text), `sources` (string[]), `createdAt`
- [ ] 1.2 Add `TokenUsage` TypeORM entity with `id`, `projectId`, `searchRequestId` (nullable), `operation`, `inputTokens`, `outputTokens`, `provider`, `createdAt`
- [ ] 1.3 Add foreign keys: `search_requests.project_id` → `projects.id` `ON DELETE CASCADE`; `token_usage.project_id` → `projects.id` `ON DELETE CASCADE`; `token_usage.search_request_id` → `search_requests.id` `ON DELETE SET NULL`
- [ ] 1.4 Add a migration creating both tables and indexes on `(project_id, created_at DESC)` for each
- [ ] 1.5 Run and verify the migration locally against PostgreSQL

## 2. Backend repositories and services

- [ ] 2.1 Register `SearchRequest` and `TokenUsage` in the relevant NestJS module
- [ ] 2.2 Add `SearchRequestRepository.create(row)` and `findRecentForProject(projectId)` (last 30 days, `createdAt DESC`)
- [ ] 2.3 Add `TokenUsageRepository.create(row)` and `findRecentForProject(projectId)` (last 30 days, `createdAt DESC`)
- [ ] 2.4 Add unit tests covering insert and the 30-day list queries for both repositories

## 3. SearchImpl: brief/reasoning + metrics

- [ ] 3.1 Update the system prompt's "Final answer format" section: always emit `BRIEF:` paragraph; emit `REASONING:` section only when reasoning was requested; keep the final `SOURCES:` line
- [ ] 3.2 Inject a short context line into messages indicating whether reasoning was requested
- [ ] 3.3 Add an `opts?: { reasoning?: boolean }` parameter to `SearchImpl.search`; default `false`
- [ ] 3.4 Track per-call `inputTokens` / `outputTokens` in `LoopState` (new `perCallTokens` array)
- [ ] 3.5 Track `t0 = Date.now()` at the start of `search`; compute `durationMs` at the end
- [ ] 3.6 Normalize the loop's exit condition into a single `stopReason: 'end_turn' | 'budget' | 'max_tokens' | 'other'` value
- [ ] 3.7 Implement `parseFinalAnswer` v2: returns `{ answer: string; reasoning?: string; sources: string[]; hadBriefMarker: boolean; hadSourcesLine: boolean }` — splits on `BRIEF:` / `REASONING:` / `SOURCES:` lines; falls back to full text as `answer` with `reasoning = undefined` when no `BRIEF:` marker
- [ ] 3.8 Change `SearchImpl.search` return type to `{ answer, reasoning?, sources, metrics }`
- [ ] 3.9 Update `search-impl.spec.ts`: cover (a) reasoning=false omits `REASONING:` block and `reasoning` is undefined, (b) reasoning=true returns both, (c) missing `BRIEF:` marker falls back to full text, (d) `metrics` reports correct iters / per-call tokens / stop reason

## 4. Search service and controller integration

- [ ] 4.1 Update `SearchController` POST body type to `{ question: string; reasoning?: boolean }` and forward `reasoning` to `SearchService.search`
- [ ] 4.2 Update `SearchService.search` signature to accept `reasoning?: boolean` and forward to `SearchImpl`
- [ ] 4.3 After `SearchImpl.search` returns, insert one `search_requests` row with the question, `reasoningRequested`, brief, reasoning, sources, and metric fields; capture its id
- [ ] 4.4 Insert N `token_usage` rows from `metrics.perCallTokens`, each with `operation = 'search'`, `project_id`, `search_request_id = <id from 4.3>`
- [ ] 4.5 Wrap both writes so failures are logged but do not affect the search response
- [ ] 4.6 Add integration tests asserting that a search inserts one `search_requests` row and N matching `token_usage` rows for a request with reasoning=true and reasoning=false

## 5. Synthesis worker integration

- [ ] 5.1 Capture `usage` from each Anthropic response in the synthesis worker and call the `TokenUsageRepository.create` with `operation = 'synthesis'`, the job's project id, and `searchRequestId = null`
- [ ] 5.2 Wrap the write so failures are logged but do not abort the synthesis job
- [ ] 5.3 Add tests asserting one row per Claude call for a synthesis job

## 6. Analytics endpoint

- [ ] 6.1 Add controller route `GET /v1/projects/:id/usage-analytics` guarded by the existing JWT + project-access auth
- [ ] 6.2 Return JSON `{ searchRequests: SearchRequestRow[], tokenUsage: TokenUsageRow[] }` for the last 30 days, ordered by `createdAt DESC`
- [ ] 6.3 Add integration tests for authorized success, unauthorized rejection, and empty-result cases

## 7. Console API client

- [ ] 7.1 Add `api.analytics.usage(projectId)` calling `GET /v1/projects/:id/usage-analytics`
- [ ] 7.2 Add TypeScript types matching the two row schemas (search request and token usage)
- [ ] 7.3 Update the existing search call site to pass `reasoning` and to consume the `{ answer, reasoning?, sources }` shape

## 8. Console UI

- [ ] 8.1 Add an "Analytics" button on the project detail page near the existing project actions
- [ ] 8.2 Add a route and page component for the project analytics view
- [ ] 8.3 Render the search-requests table (columns: Date, Question, Brief, Iters, Duration, Tokens), with row expansion to show reasoning and per-call token rows joined by `searchRequestId`
- [ ] 8.4 Render the token-usage table (columns: Date, Operation, Input Tokens, Output Tokens, Total, Provider)
- [ ] 8.5 Render an empty state when both arrays are empty
- [ ] 8.6 Add component tests covering the empty state, a populated search-requests table, and a row-expansion case

## 9. Sandbox script update

- [ ] 9.1 Update `applications/backend/sandbox/scripts/search.js` to send `{ question, reasoning }` and accept the new response shape (`answer`, optional `reasoning`, `sources`, `metrics`)
- [ ] 9.2 Update the YAML loader to accept either a flat array (existing shape) or `{ defaults: { reasoning }, queries: [...] }`; per-query `reasoning` overrides defaults
- [ ] 9.3 Log `iters`, `totalInputTokens + totalOutputTokens`, `durationMs` from `metrics` in addition to the existing local latency
- [ ] 9.4 Update `applications/backend/sandbox/queries/nami.yaml` to the explicit `defaults`/`queries` shape, including at least one query with `reasoning: true`

## 10. Verification

- [ ] 10.1 Run all backend and console tests
- [ ] 10.2 Manually verify a search with `reasoning: false` returns only `answer`; one with `reasoning: true` returns both `answer` and `reasoning`
- [ ] 10.3 Manually verify a search request inserts one `search_requests` row and N matching `token_usage` rows; a synthesis job inserts one `token_usage` row per Claude call
- [ ] 10.4 Manually verify the analytics page renders both tables and the row-expansion drill-down
- [ ] 10.5 Run the sandbox script against `queries/nami.yaml` and confirm both modes work end-to-end
