## ADDED Requirements

### Requirement: Token usage rows are persisted per Claude API call

The system SHALL persist one row in a `token_usage` table for every Claude API call performed on behalf of a project. Each row MUST include the project id, the operation (`search` or `synthesis`), the input token count, the output token count, the provider name (`claude` for now), and the creation timestamp.

#### Scenario: Search call records a row

- **WHEN** the search service receives a usage payload from Anthropic for a slug-selection or answer-generation call
- **THEN** the system inserts a row into `token_usage` with `operation = 'search'`, the calling project id, the input and output token counts from the Anthropic response, `provider = 'claude'`, and the current timestamp

#### Scenario: Synthesis call records a row

- **WHEN** the synthesis worker receives a usage payload from Anthropic for a Claude call made while synthesizing a project
- **THEN** the system inserts a row into `token_usage` with `operation = 'synthesis'`, the project id of the job being processed, the input and output token counts, `provider = 'claude'`, and the current timestamp

#### Scenario: Missing usage payload does not crash the request

- **WHEN** an Anthropic response does not include a usage payload
- **THEN** the system logs a warning and does NOT insert a `token_usage` row, and the originating search or synthesis operation completes normally

### Requirement: Token analytics endpoint returns per-call rows for a project

The system SHALL expose `GET /v1/projects/:id/token-analytics` returning the `token_usage` rows that belong to the given project for the last 30 days, ordered by `createdAt` descending. The endpoint MUST require the same authentication and project-access authorization as other project-scoped endpoints.

#### Scenario: Authorized member fetches analytics

- **WHEN** an authenticated user with access to project `P` calls `GET /v1/projects/P/token-analytics`
- **THEN** the system responds with HTTP 200 and a JSON array of rows containing `id`, `operation`, `inputTokens`, `outputTokens`, `provider`, and `createdAt`, sorted by `createdAt` descending, limited to rows from the last 30 days

#### Scenario: Unauthorized user is rejected

- **WHEN** a request to `GET /v1/projects/:id/token-analytics` arrives without a valid JWT or from a user without access to the project
- **THEN** the system responds with HTTP 401 or 403 and does NOT return any usage rows

#### Scenario: Project with no usage returns an empty array

- **WHEN** an authorized user requests analytics for a project that has no `token_usage` rows in the last 30 days
- **THEN** the system responds with HTTP 200 and an empty array

### Requirement: Console exposes a project analytics view

The console SHALL provide an "Analytics" entry point on the project page that navigates to an analytics view rendering the rows returned by the token analytics endpoint as a table with columns Date, Operation, Input Tokens, Output Tokens, Total, Provider.

#### Scenario: Project page shows the Analytics button

- **WHEN** a user opens the project page
- **THEN** the page displays an "Analytics" button alongside the existing project actions

#### Scenario: Analytics view renders the rows

- **WHEN** the user clicks the "Analytics" button and the backend returns a non-empty list of rows
- **THEN** the analytics view renders a table with one row per usage entry, showing the date, operation, input tokens, output tokens, the sum of input and output tokens as Total, and the provider

#### Scenario: Analytics view handles empty data

- **WHEN** the backend returns an empty array of rows
- **THEN** the analytics view renders an empty state instead of an empty table
