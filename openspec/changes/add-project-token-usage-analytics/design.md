## Context

Anthropic API calls happen in two places today:

- `SearchImpl.search()` (`applications/backend/shared/src/search/search.impl.ts`) — two synchronous calls per search (slug selection + answer generation).
- `SynthesisImpl.synthesize()` (`applications/backend/shared/src/synthesis/synthesis.impl.ts`) — one streamed call, executed inside the synthesis worker process and reported back to the API through the existing `POST /internal/synthesis/status` callback (see `synthesis-job-contract`).

The Anthropic SDK returns `usage: { input_tokens, output_tokens, ... }` on non-streaming responses and emits a final `message_delta` event with usage on streamed responses. Today this data is discarded.

There is an `api_key_audit_logs` table, but it tracks API-key lifecycle, not call-level usage. A new dedicated table is the cleanest fit.

The console SPA already has org/project routing and an authenticated fetch layer; adding a new page is a localized change.

## Goals / Non-Goals

**Goals:**
- One row per search (combined tokens of both Claude calls) and one row per synthesis run in a new `api_token_usage` table.
- Synthesis worker reports tokens to API via callback; the worker process never writes the analytics table.
- Failed Claude calls still produce a row (input/output tokens = 0) so failure rate is visible alongside successes.
- Paginated read endpoint (20/page, latest-first) available to every org member.
- Console exposes an `Analytics` button on the project page leading to a plain table view.

**Non-Goals:**
- No cost-in-USD estimation, no provider beyond `claude`, no graphs, no date-range filtering, no CSV export, no org-level aggregation.
- No retroactive backfill; analytics start when the migration ships.
- No changes to `api_key_audit_logs`.

## Decisions

**D1. Raw event log over pre-aggregated rows.**
Chosen so we can answer future questions (per-day, per-operation, per-model) without re-instrumenting. Pagination of 20 rows per page satisfies the v1 UI requirement; aggregation can be layered later via SQL. Alternative considered: daily aggregated rows — rejected because it locks the schema to today's UI and discards detail.

**D2. One row per search, summing both Claude calls.**
The owner explicitly chose this over emitting two rows. Implementation: `SearchImpl.search()` accumulates `inputTokens` and `outputTokens` across slug-selection and answer-generation responses and emits a single record at the end (success or failure). Model recorded is the model used for answer generation (the user-facing call).

**D3. Worker reports usage via callback; API persists.**
The synthesis worker remains the boundary owner — it does not gain a write-path to the analytics table. The existing `POST /internal/synthesis/status` callback is extended with an optional `usage: { model, inputTokens, outputTokens }` field. When present, the API inserts an `api_token_usage` row in the same handler that updates `synthStatus`. Alternative considered: worker writes directly to Postgres — rejected because it widens the worker's surface area and contradicts the owner's choice (Q3=b).

**D4. Failure rows carry zero tokens.**
On caught Anthropic errors, both `SearchImpl` and `SynthesisImpl` record `inputTokens=0`, `outputTokens=0`, and the configured model. This keeps the table additive (no `status` column) while still surfacing failures via row count vs. token sum.

**D5. Authorization: org membership, not admin.**
The read endpoint reuses the existing project-membership guard already used by `GET /v1/projects/:projectId` — any user in the parent org can read.

**D6. Pagination contract.**
`GET /v1/projects/:projectId/analytics/token-usage?page=1` returns `{ items: TokenUsageEvent[], page, pageSize: 20, total }`. `page` is 1-indexed. Ordering is `timestamp DESC, id DESC` (id breaks ties for events written in the same millisecond).

## Risks / Trade-offs

- **Streaming usage extraction is API-version-sensitive** → mitigate by reading from `final_message.usage` on the resolved stream rather than from intermediate `message_delta` events.
- **Recording adds latency to the hot search path** → mitigate by writing the row after the response is returned (fire-and-forget within the request, but awaited inside the same handler so failures are logged; ~1 cheap insert).
- **Table can grow without bound** → acceptable for v1; retention/aggregation is an explicit non-goal.
- **Callback payload widens** → backwards-compatible (field is optional); old worker builds continue to work, they simply don't populate analytics.

## Migration Plan

1. Ship DB migration creating `api_token_usage` with indexes on `(projectId, timestamp DESC)`.
2. Deploy API with the new endpoint and the extended callback handler (still accepts callbacks without `usage`).
3. Deploy worker that includes `usage` in its callback payload.
4. Deploy console with the Analytics button and page.

Rollback: revert console + worker (analytics page empty); API endpoint and table can stay in place safely.

## Open Questions

None — owner answered all five exploration questions in the issue thread.
