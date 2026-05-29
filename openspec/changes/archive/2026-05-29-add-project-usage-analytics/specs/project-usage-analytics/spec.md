## ADDED Requirements

### Requirement: Search request rows are persisted per /search call

The system SHALL persist one row in a `search_requests` table for every `/search` request handled on behalf of a project. Each row MUST include the project id, the question text, the `reasoning_requested` flag, the iteration count, pages read, total input tokens, total output tokens, duration in milliseconds, stop reason, the brief answer text, the reasoning answer text (nullable), the source slugs array, and the creation timestamp.

#### Scenario: Successful search inserts an aggregate row

- **WHEN** the search service completes a `/search` request for project `P` with question `Q`
- **THEN** the system inserts a row into `search_requests` with `project_id = P`, `question = Q`, `reasoning_requested` matching the request, the agentic loop metrics (`iters`, `pages_read`, `total_input_tokens`, `total_output_tokens`, `duration_ms`, `stop_reason`), `answer_brief` set to the brief paragraph, `answer_reasoning` set to the reasoning section (or NULL if not produced), `sources` set to the source slugs, and the current timestamp

#### Scenario: Aggregate write failure does not crash the request

- **WHEN** inserting the `search_requests` row fails for any reason
- **THEN** the system logs the failure and the search response is still returned to the caller

### Requirement: Token usage rows are persisted per Claude API call

The system SHALL persist one row in a `token_usage` table for every Claude API call performed on behalf of a project. Each row MUST include the project id, an optional `search_request_id` (set for search calls, NULL for synthesis calls), the operation (`search` or `synthesis`), the input token count, the output token count, the provider name (`claude` for now), and the creation timestamp.

#### Scenario: Search call records a row linked to its parent search request

- **WHEN** the search service receives a usage payload from Anthropic during the agentic tool-use loop
- **THEN** the system inserts a row into `token_usage` with `operation = 'search'`, the calling project id, `search_request_id` set to the id of the `search_requests` row for the same request, the input and output token counts from the Anthropic response, `provider = 'claude'`, and the current timestamp

#### Scenario: Synthesis call records a row without a search request link

- **WHEN** the synthesis worker receives a usage payload from Anthropic for a Claude call made while synthesizing a project
- **THEN** the system inserts a row into `token_usage` with `operation = 'synthesis'`, the project id of the job being processed, `search_request_id = NULL`, the input and output token counts, `provider = 'claude'`, and the current timestamp

#### Scenario: Missing usage payload does not crash the request

- **WHEN** an Anthropic response does not include a usage payload
- **THEN** the system logs a warning and does NOT insert a `token_usage` row, and the originating search or synthesis operation completes normally

### Requirement: Usage analytics endpoint returns search requests and token usage for a project

The system SHALL expose `GET /v1/projects/:id/usage-analytics` returning the `search_requests` and `token_usage` rows that belong to the given project for the last 30 days, each ordered by `createdAt` descending. The endpoint MUST require the same authentication and project-access authorization as other project-scoped endpoints.

#### Scenario: Authorized member fetches analytics

- **WHEN** an authenticated user with access to project `P` calls `GET /v1/projects/P/usage-analytics`
- **THEN** the system responds with HTTP 200 and a JSON object `{ searchRequests, tokenUsage }`, each an array sorted by `createdAt` descending, limited to rows from the last 30 days
- **AND** each `searchRequests` row contains `id`, `question`, `reasoningRequested`, `iters`, `pagesRead`, `totalInputTokens`, `totalOutputTokens`, `durationMs`, `stopReason`, `answerBrief`, `answerReasoning`, `sources`, `createdAt`
- **AND** each `tokenUsage` row contains `id`, `searchRequestId`, `operation`, `inputTokens`, `outputTokens`, `provider`, `createdAt`

#### Scenario: Unauthorized user is rejected

- **WHEN** a request to `GET /v1/projects/:id/usage-analytics` arrives without a valid JWT or from a user without access to the project
- **THEN** the system responds with HTTP 401 or 403 and does NOT return any usage rows

#### Scenario: Project with no usage returns empty arrays

- **WHEN** an authorized user requests analytics for a project that has no rows in the last 30 days
- **THEN** the system responds with HTTP 200 and `{ searchRequests: [], tokenUsage: [] }`

### Requirement: Console exposes a project usage analytics view

The console SHALL provide an "Analytics" entry point on the project page that navigates to an analytics view rendering both arrays returned by the usage analytics endpoint. The view MUST show a search-requests table (columns Date, Question, Brief, Iters, Duration, Tokens) with row expansion revealing the reasoning text and the per-call `token_usage` rows linked by `searchRequestId`, and a token-usage table (columns Date, Operation, Input Tokens, Output Tokens, Total, Provider).

#### Scenario: Project page shows the Analytics button

- **WHEN** a user opens the project page
- **THEN** the page displays an "Analytics" button alongside the existing project actions

#### Scenario: Analytics view renders both tables

- **WHEN** the user clicks the "Analytics" button and the backend returns non-empty arrays
- **THEN** the analytics view renders the search-requests table with one row per `search_requests` entry and the token-usage table with one row per `token_usage` entry

#### Scenario: Expanding a search request reveals reasoning and per-call rows

- **WHEN** the user expands a search-requests row whose `answerReasoning` is non-null and which has linked `token_usage` rows
- **THEN** the view shows the reasoning text and the linked per-call token rows

#### Scenario: Analytics view handles empty data

- **WHEN** the backend returns empty arrays for both tables
- **THEN** the analytics view renders an empty state instead of empty tables
