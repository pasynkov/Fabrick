## Why

Project members have no visibility into Anthropic API token consumption per project. Without this, teams cannot reason about cost drivers, attribute usage to operations (search vs. synthesis), or detect regressions in prompt size. Token usage data is already returned by the Anthropic SDK but is currently discarded.

## What Changes

- Add a new `api_token_usage` table that records one raw event per Anthropic call (project, operation, provider, model, input/output tokens, timestamp).
- Record one row per `SearchImpl.search()` invocation, summing tokens from both Anthropic calls (slug-selection + answer-generation).
- Record one row per synthesis run; the synthesis worker reports usage back to the API via the existing job-completion callback. The worker MUST NOT write the analytics table directly.
- Log a row with zero input/output tokens when a Claude call fails, so failure rate stays observable.
- Expose `GET /v1/projects/:projectId/analytics/token-usage` returning the raw event log, paginated 20 rows per page, sorted by latest first. All org members may read it.
- Add an `Analytics` button on the project detail page that routes to a new `/orgs/:orgSlug/projects/:projectSlug/analytics` page rendering a paginated table (no graphs).

## Capabilities

### New Capabilities
- `project-token-usage-analytics`: Per-project recording, retrieval, and console rendering of Anthropic API token usage events.

### Modified Capabilities
- `shared-search-impl`: `SearchImpl.search()` MUST emit a token-usage event after each completed (or failed) search.
- `synthesis-job-contract`: Worker completion callback MUST include per-run token usage so the API can persist an analytics row.

## Impact

- New DB migration for `api_token_usage` (indexes on `projectId` and `timestamp`).
- New API route under `/v1/projects/:projectId/analytics/token-usage`.
- `SearchImpl` and `SynthesisProcessor` instrument Anthropic responses (including streamed `message_delta` events) to collect usage.
- Console adds a new route, navigation button on `ProjectDetail`, and a data-fetching hook backed by the new endpoint.
- No new external dependencies. Provider enum is fixed to `claude` for v1.
