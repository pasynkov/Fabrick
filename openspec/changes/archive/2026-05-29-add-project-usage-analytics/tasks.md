## 1. Database schema

- [x] 1.1 Add `SearchRequest` TypeORM entity with `id`, `projectId`, `question`, `reasoningRequested`, `iters`, `pagesRead`, `totalInputTokens`, `totalOutputTokens`, `durationMs`, `stopReason`, `answerBrief`, `answerReasoning` (nullable text), `sources` (string[]), `createdAt`
- [x] 1.2 Add `TokenUsage` TypeORM entity with `id`, `projectId`, `searchRequestId` (nullable), `operation`, `inputTokens`, `outputTokens`, `provider`, `createdAt`
- [x] 1.3 Add foreign keys: `search_requests.project_id` → `projects.id` `ON DELETE CASCADE`; `token_usage.project_id` → `projects.id` `ON DELETE CASCADE`; `token_usage.search_request_id` → `search_requests.id` `ON DELETE SET NULL`
- [x] 1.4 Add a migration creating both tables and indexes on `(project_id, created_at DESC)` for each
- [x] 1.5 Run and verify the migration locally against PostgreSQL

## 2. Backend repositories and services

- [x] 2.1 Register `SearchRequest` and `TokenUsage` in the relevant NestJS module
- [x] 2.2 Add `SearchRequestRepository.create(row)` and `findRecentForProject(projectId)` (last 30 days, `createdAt DESC`)
- [x] 2.3 Add `TokenUsageRepository.create(row)` and `findRecentForProject(projectId)` (last 30 days, `createdAt DESC`)
- [x] 2.4 Add unit tests covering insert and the 30-day list queries for both repositories (covered by analytics.e2e.ts)

## 3. SearchImpl: brief/reasoning + metrics

- [x] 3.1 Update the system prompt's "Final answer format" section: always emit `BRIEF:` paragraph; emit `REASONING:` section only when reasoning was requested; keep the final `SOURCES:` line
- [x] 3.2 Inject a short context line into messages indicating whether reasoning was requested
- [x] 3.3 Add an `opts?: { reasoning?: boolean }` parameter to `SearchImpl.search`; default `false`
- [x] 3.4 Track per-call `inputTokens` / `outputTokens` in `LoopState` (new `perCallTokens` array)
- [x] 3.5 Track `t0 = Date.now()` at the start of `search`; compute `durationMs` at the end
- [x] 3.6 Normalize the loop's exit condition into a single `stopReason: 'end_turn' | 'budget' | 'max_tokens' | 'other'` value
- [x] 3.7 Implement `parseFinalAnswer` v2: returns `{ answer, reasoning?, sources, hadBriefMarker, hadSourcesLine }`
- [x] 3.8 Change `SearchImpl.search` return type to `{ answer, reasoning?, sources, metrics }`
- [x] 3.9 Update `search-impl.spec.ts` with reasoning=false, reasoning=true, missing BRIEF, metrics

## 4. Search service and controller integration

- [x] 4.1 Update `SearchController` POST body type to `{ question: string; reasoning?: boolean }`
- [x] 4.2 Update `SearchService.search` signature to accept `reasoning?: boolean`
- [x] 4.3 Insert one `search_requests` row after `SearchImpl.search` returns
- [x] 4.4 Insert N `token_usage` rows from `metrics.perCallTokens` linked to the new `search_request_id`
- [x] 4.5 Wrap both writes so failures are logged but do not affect the search response
- [x] 4.6 Add integration tests (analytics.e2e.ts asserts rows persist and link correctly; repository methods verified end-to-end)

## 5. Synthesis worker integration

- [x] 5.1 Capture usage from each Anthropic synthesis response; worker posts to new internal API endpoint that calls TokenUsageRepository.create
- [x] 5.2 Wrap the write so failures are logged but do not abort the synthesis job (best-effort fetch + try/catch in service)
- [x] 5.3 Update synthesis processor tests to cover happy path with usage and the no-usage fallback

## 6. Analytics endpoint

- [x] 6.1 Add controller route `GET /v1/projects/:id/usage-analytics` guarded by FabrickAuthGuard
- [x] 6.2 Return JSON `{ searchRequests, tokenUsage }` for the last 30 days, ordered by `createdAt DESC`
- [x] 6.3 Integration tests for authorized success, unauthorized rejection, and empty-result cases

## 7. Console API client

- [x] 7.1 Add `api.analytics.usage(projectId)` calling `GET /v1/projects/:id/usage-analytics`
- [x] 7.2 Add TypeScript types matching the two row schemas
- [x] 7.3 Update the existing search call site to pass `reasoning` and to consume the `{ answer, reasoning?, sources }` shape

## 8. Console UI

- [x] 8.1 Add an "Analytics" button on the project detail page near the existing project actions
- [x] 8.2 Add a route and page component for the project analytics view (`/orgs/:org/projects/:proj/analytics`)
- [x] 8.3 Render the search-requests table with row expansion to show reasoning and per-call token rows
- [x] 8.4 Render the token-usage table
- [x] 8.5 Render an empty state when both arrays are empty
- [ ] 8.6 Add component tests covering the empty state, a populated search-requests table, and a row-expansion case — SKIPPED: no test framework configured for the console app

## 9. Sandbox script update

- [x] 9.1 Update `applications/backend/sandbox/scripts/search.js` to send `{ question, reasoning }` and accept the new response shape
- [x] 9.2 Update the YAML loader to accept either a flat array or `{ defaults: { reasoning }, queries: [...] }`
- [x] 9.3 Log `iters`, `totalInputTokens + totalOutputTokens`, `durationMs` from `metrics`
- [x] 9.4 Update `applications/backend/sandbox/queries/nami.yaml` to the explicit shape with a `reasoning: true` query

## 10. Verification

- [x] 10.1 Run all backend tests (api unit + e2e + synthesis worker tests — all green)
- [ ] 10.2 Manually verify reasoning=false / reasoning=true response shapes — deferred (requires live Anthropic key; covered by unit tests)
- [ ] 10.3 Manually verify rows land in DB — deferred (covered by analytics.e2e.ts integration test)
- [ ] 10.4 Manually verify console renders — deferred (manual; build + tsc -b passes)
- [ ] 10.5 Run sandbox against `queries/nami.yaml` — deferred (requires live API key + running api)
