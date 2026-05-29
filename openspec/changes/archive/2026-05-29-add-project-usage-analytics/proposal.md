## Why

Project members have no visibility into how their projects consume Claude tokens during search and synthesis. They also cannot inspect *which questions* were asked and *how the search agent answered them*, which blocks tuning the system prompt, the budget, and the wiki structure. A first-version analytics view answers two questions: "how much have we spent on tokens lately?" and "what did people ask, and how well did the agent answer?". Additionally, the current search always returns a verbose reasoning answer; callers need a concise default with an opt-in reasoning section.

## What Changes

### Search behavior
- `SearchImpl.search` accepts an optional `reasoning` flag. The system prompt is updated to emit a `BRIEF:` paragraph always, and a `REASONING:` section only when reasoning was requested. The very last line remains `SOURCES: <slug>, ...`.
- The search response shape becomes `{ answer: string, reasoning?: string, sources: string[] }`. `answer` is the brief paragraph. `reasoning` is present only when the caller requested it.
- If the model fails to emit a `BRIEF:` marker, the full text is returned as `answer` and no `reasoning` field is set.
- The `POST /v1/orgs/:orgSlug/projects/:projectSlug/search` body becomes `{ question: string, reasoning?: boolean }`. Default `reasoning = false`.

### Persisted analytics
- New `search_requests` table holding one row per `/search` request: project id, question text, `reasoning_requested`, iters, pages read, total input/output tokens, duration ms, stop reason, `answer_brief`, `answer_reasoning` (nullable), sources array, timestamp.
- Existing `token_usage` table (introduced by this same change) gains a nullable `search_request_id` FK column. Search calls populate it; synthesis calls leave it `NULL`.
- The search service writes one `search_requests` row at the end of the loop, plus N `token_usage` rows (one per Anthropic call) linked via `search_request_id`.
- The synthesis worker continues to write one `token_usage` row per Claude call, with `search_request_id = NULL`.

### API
- New endpoint `GET /v1/projects/:id/usage-analytics` returning two arrays for the last 30 days:
  - `searchRequests`: rows from `search_requests` (newest first) including question, brief answer, reasoning, sources, metrics
  - `tokenUsage`: rows from `token_usage` (newest first)
- Auth and project access checks mirror existing project endpoints.

### Console
- New "Analytics" button on the project page.
- New analytics page rendering two tables: search requests (Date, Question, Brief, Iters, Duration, Tokens) and token usage (Date, Operation, Input, Output, Total, Provider). Expanding a search request row reveals its full reasoning (if stored) and the per-call token rows linked by `search_request_id`.

### Sandbox tooling
- `applications/backend/sandbox/scripts/search.js` accepts the new request shape. Sandbox query YAML format supports a per-query `reasoning` flag and an optional top-level `defaults.reasoning`. The script logs the new aggregate metrics (`iters`, `totalTokens`, `durationMs`) reported by the search response.

## Capabilities

### New Capabilities
- `project-usage-analytics`: persisting per-request search analytics and per-call Claude token usage, plus an authenticated backend endpoint and a console view rendering both.

### Modified Capabilities
- `fabrick-search`: accepts an optional `reasoning` flag, returns a brief answer by default with optional reasoning, and emits one aggregate `search_requests` row plus one `token_usage` row per Anthropic call performed during the agentic tool-use loop.
- `project-wiki-synthesis`: writes one `token_usage` row per Claude API call performed during synthesis, attributed to the originating project.

## Impact

- Backend: new TypeORM entities (`SearchRequest`, `TokenUsage`), repository/service for both, new controller, migrations for both tables (and FK column), changes to `SearchImpl`, `SearchService`, `SearchController`, and the synthesis worker.
- Frontend: new console route/page, new API client method, new button on the project detail page, updated search call sites if any consume the existing `answer` shape directly.
- Database: two new tables. `token_usage.search_request_id` FK to `search_requests(id) ON DELETE SET NULL`. `search_requests.project_id` FK to `projects(id) ON DELETE CASCADE`.
- Sandbox: updated `scripts/search.js` and YAML format. Existing `queries/nami.yaml` updated to the new format.
- No breaking changes for existing search consumers that ignore the new optional `reasoning` field; the `answer` field continues to be the primary content (now brief by default).
