## Context

Fabrick uses Claude for two project-scoped operations:

- **Search** (`/orgs/:orgSlug/projects/:projectSlug/search`): the backend issues two Anthropic calls per request (slug selection + answer generation). Tokens are not currently captured.
- **Synthesis** (`/projects/:id/synthesis`): a worker triggered through a message queue makes one or more Claude calls per repository being synthesized. Token counts are not currently surfaced.

The backend is a NestJS API with TypeORM on PostgreSQL, JWT auth, and versioned `/v1/*` endpoints. The console is a React app with a small API client layer. Project pages already host an action area (next to the "Synthesis" button) where new entry points can be added.

There is no existing analytics infrastructure. The first version targets per-project visibility only, so we can keep the scope to a single table, a single endpoint, and a single page.

## Goals / Non-Goals

**Goals:**
- One row per Claude API call, attributed to the project that triggered it.
- Persist provider, operation (`search` | `synthesis`), input tokens, output tokens, and timestamp.
- Surface the rows in a project-scoped console table covering the last 30 days by default.
- Reuse existing auth, controller, and TypeORM patterns (no new frameworks).

**Non-Goals:**
- Cost estimation, graphs, or month-over-month comparison.
- Organization-level dashboards.
- Alerts or thresholds.
- Aggregations beyond the per-row totals already computable client-side.
- Tracking providers other than Claude.

## Decisions

### Data model: dedicated `token_usage` table
A new entity instead of extending `ApiKeyAuditLog`. Audit logs answer "who used the key"; token usage answers "how much was consumed". Mixing them couples two unrelated concerns and complicates queries. The table has `id`, `project_id`, `operation`, `input_tokens`, `output_tokens`, `provider`, `created_at`, with an index on `(project_id, created_at DESC)` to support the listing query.

### Granularity: per-call, not per-request
We write one row per Anthropic call. Search produces two rows per user request; synthesis produces one row per Claude call inside the worker. This avoids aggregation logic on the write path and keeps the schema flat. Totals are computed client-side from the rows returned by the endpoint.

Alternative considered: per-request aggregation. Rejected because synthesis spans many calls over time and aggregating would force the worker to buffer state across the job.

### Endpoint: `GET /v1/projects/:id/token-analytics`
Returns an array of rows for the project. Default window is last 30 days; window is fixed in v1 (no query parameters) to keep the contract minimal. Auth reuses the existing project access guard.

### Synthesis attribution
The synthesis worker already knows the project id of the job it is processing. It writes each row directly to `token_usage` through the shared repository. No callback or message-queue change is needed.

### Provider field
Stored as a string column with default `'claude'`. Keeping it a string (not an enum) avoids a migration when a second provider is added later.

### Frontend integration
A new `analytics.usage(projectId)` method on the API client, a new route under the project section, and a button on the project detail page next to the existing Synthesis action. The page renders a single table; sorting and pagination are out of scope for v1.

## Risks / Trade-offs

- [Synthesis worker partial failures may leave token rows without a finished job] → Acceptable for v1; rows still reflect real token spend and we do not promise referential integrity to a job entity.
- [Per-call rows can grow quickly for chatty projects] → The `(project_id, created_at DESC)` index plus the 30-day window keeps the read path bounded. Retention/archival is deferred.
- [Anthropic SDK may omit `usage` fields on streaming or error responses] → We only insert when `usage` is present; missing data is logged but not retried.
- [Adding a write to the search hot path] → The insert is fire-and-forget relative to the user response (awaited but cheap); failures are logged and do not break the search response.

## Migration Plan

1. Ship the migration creating `token_usage` (idempotent, additive).
2. Deploy the backend with usage capture in search and synthesis, and the new endpoint.
3. Deploy the console with the Analytics button and page.
4. Rollback: revert the console first (button disappears), then the backend; the table can be left in place or dropped via a down migration.
