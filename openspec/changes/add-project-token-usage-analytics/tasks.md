## 1. Database

- [ ] 1.1 Write a migration test asserting `api_token_usage` table exists with expected columns and the `(projectId, timestamp DESC)` index after migration runs
- [ ] 1.2 Create TypeORM migration adding `api_token_usage` table and composite index
- [ ] 1.3 Add `ApiTokenUsage` entity, repository, and module wiring [no-test]

## 2. TokenUsageRecorder port and adapter

- [ ] 2.1 Write unit tests for the DB-backed `TokenUsageRecorder` that record a row and return the inserted entity (success + zero-token cases)
- [ ] 2.2 Implement `TokenUsageRecorder` port (interface) in `shared` and the TypeORM-backed adapter in the API
- [ ] 2.3 Bind the recorder in DI for both API and worker contexts (worker uses a no-op adapter — it does NOT write to DB) [no-test]

## 3. SearchImpl instrumentation

- [ ] 3.1 Write unit tests asserting `SearchImpl.search()` calls `TokenUsageRecorder.record` once with summed input/output tokens for the success path
- [ ] 3.2 Write unit tests asserting failed Anthropic call emits a zero-token event and re-throws the original error
- [ ] 3.3 Write a unit test asserting that a `TokenUsageRecorder.record` failure is logged and does not break the search
- [ ] 3.4 Implement summed-usage recording in `SearchImpl.search()` via the injected recorder

## 4. Synthesis callback payload

- [ ] 4.1 Write unit tests for `SynthesisImpl` asserting the resolved stream's final `usage` is extracted into `{ model, inputTokens, outputTokens }` and surfaced to the worker callback
- [ ] 4.2 Write unit tests for the synthesis failure path asserting the worker still emits a `usage` block with `inputTokens=0`, `outputTokens=0`
- [ ] 4.3 Extend `SynthesisImpl` and the synthesis worker to extract usage and include it in the existing job-completion callback payload

## 5. API: status callback persists analytics row

- [ ] 5.1 Write API integration tests for `POST /internal/synthesis/status` covering: `usage` present → row inserted + status updated; `usage` absent → only status updated; failure callback with zero-token `usage` → zero-token row inserted; invalid token → 401, no row inserted
- [ ] 5.2 Extend the status callback handler to validate optional `usage` payload and insert an `api_token_usage` row in the same handler

## 6. API: GET token-usage endpoint

- [ ] 6.1 Write API integration tests for `GET /v1/projects/:projectId/analytics/token-usage`: page=1 returns latest 20 sorted desc; page=2 returns remainder; empty project returns `total=0`; non-member returns 403; org member returns 200
- [ ] 6.2 Implement the controller, service, and DTO (`{ items, page, pageSize: 20, total }`), reusing the existing project-membership guard

## 7. Console: Analytics page

- [ ] 7.1 Write a component test asserting the `Analytics` button appears on the project detail page and links to `/orgs/:orgSlug/projects/:projectSlug/analytics`
- [ ] 7.2 Write a component test for the analytics page asserting it renders one table row per event from the API mock and shows columns Date / Operation / Model / Input Tokens / Output Tokens
- [ ] 7.3 Write a component test asserting Next/Previous pagination buttons request `?page=N` and re-render the table
- [ ] 7.4 Implement the `Analytics` button on `ProjectDetail`, the new route, the data-fetching hook, and the paginated table component

## 8. Verification

- [ ] 8.1 Run the full backend test suite and confirm green [no-test]
- [ ] 8.2 Run the console test suite and confirm green [no-test]
- [ ] 8.3 Manual smoke: trigger one search and one synthesis on a dev project, open the Analytics page, verify both rows appear with non-zero tokens [no-test]
