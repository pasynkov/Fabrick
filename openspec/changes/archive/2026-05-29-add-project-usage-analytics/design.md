## Context

Fabrick uses Claude for two project-scoped operations:

- **Search** (`POST /v1/orgs/:orgSlug/projects/:projectSlug/search`): `SearchImpl` runs an agentic tool-use loop. Each iteration is one `anthropic.messages.create` call; the loop ends on `stop_reason = end_turn`, budget exhaustion, or `max_tokens`. The number of calls per request varies (typically 2–8). Tokens are currently logged but not persisted.
- **Synthesis** (`/projects/:id/synthesis`): a worker triggered through a message queue makes one or more Claude calls per repository being synthesized. Token counts are not currently surfaced.

The backend is a NestJS API with TypeORM on PostgreSQL, JWT auth, and versioned `/v1/*` endpoints. The console is a React app with a small API client layer. Project pages already host an action area (next to the "Synthesis" button) where new entry points can be added.

There is no existing analytics infrastructure. The first version targets per-project visibility: who asked what, how much it cost in tokens, and how the agent answered.

## Goals / Non-Goals

**Goals:**
- One row per `/search` request, persisting the question, the brief answer, the optional reasoning answer, sources, loop metrics (iters, pages read, duration), and total tokens.
- One row per Claude API call, attributed to the project that triggered it, and (for search calls) linked to the parent search request.
- Search response defaults to a brief paragraph; reasoning section is opt-in via the request body.
- Surface both tables in a project-scoped console view covering the last 30 days by default.
- Reuse existing auth, controller, and TypeORM patterns (no new frameworks).

**Non-Goals:**
- Cost estimation, graphs, month-over-month comparison.
- Organization-level dashboards.
- Alerts or thresholds.
- Aggregations on the server beyond the per-row totals computable client-side.
- Tracking providers other than Claude.
- Re-running historical searches with the new prompt format.

## Decisions

### Data model: `search_requests` + `token_usage`

Two tables:

- `search_requests` — one row per `/search` request. Holds the question text, `reasoning_requested` boolean, `iters`, `pages_read`, `total_input_tokens`, `total_output_tokens`, `duration_ms`, `stop_reason`, `answer_brief`, `answer_reasoning` (nullable text), `sources` (text array), `created_at`. Index on `(project_id, created_at DESC)`.
- `token_usage` — one row per Anthropic call. Holds `project_id`, `search_request_id` (nullable FK to `search_requests`), `operation` (`search` | `synthesis`), `input_tokens`, `output_tokens`, `provider`, `created_at`. Index on `(project_id, created_at DESC)`.

Rationale: search requests have meaningful per-request structure (question, brief, reasoning, total metrics) that does not fit a flat per-call schema. Synthesis has no equivalent request boundary that the worker can cheaply group on, so it stays per-call only.

Storing the full question and both answer texts is intentional: the value of this analytics view is letting us iterate on the prompt, the wiki structure, and the budget by inspecting real traffic. PII risk is bounded — only authenticated project members can read the data, and the same members are typically the ones submitting the questions.

Alternative considered: store metrics on `search_requests` only, leave per-call detail unstored. Rejected because the per-call breakdown is the only way to spot which iteration is burning tokens (e.g. the partial-finalization call after budget exhaustion).

### Search response shape and prompt format

`SearchImpl.search` signature becomes:

```ts
search(
  projectId: string,
  question: string,
  apiKey: string,
  opts?: { reasoning?: boolean },
): Promise<{
  answer: string;
  reasoning?: string;
  sources: string[];
  metrics: {
    iters: number;
    pagesRead: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    durationMs: number;
    stopReason: 'end_turn' | 'budget' | 'max_tokens' | 'other';
    perCallTokens: Array<{ inputTokens: number; outputTokens: number }>;
  };
}>
```

The system prompt's "Final answer format" section is rewritten to:

```
Final answer format:
- A single concise paragraph answering the question, prefixed by a line containing only "BRIEF:".
- If reasoning was requested by the caller, follow with a line containing only "REASONING:", then a detailed explanation.
- The very last line MUST be: SOURCES: <slug>, <slug>, ...
  using only the slugs whose content you actually used.
```

Whether reasoning was requested is injected into the prompt context (a short user-message line like `Reasoning requested: true|false`).

Parser:
- If `BRIEF:` marker found: `answer` = text between `BRIEF:` and (the next `REASONING:` or the `SOURCES:` line, exclusive). `reasoning` = text between `REASONING:` and the `SOURCES:` line, if present.
- If no `BRIEF:` marker: `answer` = full text minus `SOURCES:` line, `reasoning = undefined`. Logged as a warning.

The HTTP response always returns `answer` and `sources`. `reasoning` is included only when present.

### Request shape

`POST /v1/orgs/:orgSlug/projects/:projectSlug/search` body:

```json
{ "question": "...", "reasoning": false }
```

`reasoning` defaults to `false`. The controller forwards it to `SearchService`, which forwards it to `SearchImpl`.

### Persisting analytics

`SearchService.search` wraps `SearchImpl.search` and, after the loop completes:
1. Inserts one `search_requests` row using the question, the answer pair, and the metrics returned.
2. Inserts N `token_usage` rows from `metrics.perCallTokens`, each with `search_request_id` set to the row created in step 1.

Both writes are best-effort: failures are logged and do not affect the search response.

The synthesis worker writes one `token_usage` row per Claude call with `search_request_id = NULL`.

### Endpoint: `GET /v1/projects/:id/usage-analytics`

Returns `{ searchRequests: SearchRequestRow[], tokenUsage: TokenUsageRow[] }`. Both arrays are scoped to the project, ordered by `createdAt DESC`, limited to the last 30 days. The 30-day window is fixed in v1; no query parameters. Auth reuses the existing project access guard.

A single endpoint (not two) is intentional: the console renders both tables side by side, and one round-trip simplifies the UI.

### Frontend integration

A new `api.analytics.usage(projectId)` method, a new route under the project section, and a button on the project detail page next to the existing Synthesis action. The page renders two tables. The search-requests table supports row expansion (reveals reasoning if present, plus the per-call token rows joined by `search_request_id`). No sorting/pagination in v1.

### Sandbox YAML format

The script must support a `reasoning` flag per query and a top-level default. Two accepted shapes:

```yaml
# minimal — implicit defaults
- name: nats
  question: Which NATS subjects...

# explicit with defaults + override
defaults:
  reasoning: false
queries:
  - name: nats
    question: Which NATS subjects...
    reasoning: true
  - name: conductor
    question: Could I run conductor in a few exemplars?
```

The loader detects which shape was given. When `defaults` is absent, `reasoning` falls back to `false`. The script logs `iters`, `totalTokens`, `durationMs` from `metrics` in the response body in addition to the existing per-request latency it measures locally.

`queries/nami.yaml` is updated to the explicit shape so we can exercise both modes from the same file.

## Risks / Trade-offs

- [`search_requests` rows store free-form user input and model output] → Same access controls as project pages. Acceptable for v1; revisit if non-members ever gain read access to a project's analytics.
- [Per-call rows can grow quickly for chatty projects] → The `(project_id, created_at DESC)` indices plus the 30-day window keep the read path bounded. Retention/archival is deferred.
- [`BRIEF:` / `REASONING:` markers depend on the model honouring the format] → Fallback returns the full text as `answer`. Worst case: a slightly verbose answer; nothing breaks.
- [Anthropic SDK may omit `usage` fields] → Per-call rows are written only when `usage` is present. The `search_requests` aggregate still records what we have.
- [Two writes on the search hot path] → Both are awaited but cheap; failures are logged and do not break the response.

## Migration Plan

1. Ship the migration creating `search_requests` and `token_usage` (idempotent, additive). Both tables include the FK on `project_id`. `token_usage.search_request_id` is nullable from the start.
2. Deploy the backend with the updated `SearchImpl` (new response shape + metrics), `SearchService` (writes both row types), `SearchController` (accepts `reasoning` in body), the synthesis worker change, and the new analytics endpoint.
3. Deploy the console with the Analytics button and page.
4. Update the sandbox script and `queries/nami.yaml`.
5. Rollback: revert the console first (button disappears), then the backend; the tables can be left in place or dropped via a down migration. The search response shape change is additive (`reasoning` is optional, `answer` continues to carry the primary content), so old clients keep working.
