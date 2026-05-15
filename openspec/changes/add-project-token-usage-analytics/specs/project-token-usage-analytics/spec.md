## ADDED Requirements

### Requirement: api_token_usage table persists per-call token events
The system SHALL persist one row per Anthropic API operation (search or synthesis) in a table named `api_token_usage` with columns: `id` (uuid), `projectId` (uuid, indexed), `operation` (enum `search` | `synthesis`), `provider` (enum, currently only `claude`), `model` (string), `inputTokens` (int, ≥ 0), `outputTokens` (int, ≥ 0), `timestamp` (timestamptz, indexed). A composite index on `(projectId, timestamp DESC)` SHALL exist to support paginated reads.

#### Scenario: Successful search inserts one row
- **WHEN** a search completes successfully for project `P` using model `claude-sonnet-X`
- **THEN** exactly one `api_token_usage` row exists with `projectId=P`, `operation='search'`, `provider='claude'`, `model='claude-sonnet-X'`, `inputTokens` and `outputTokens` equal to the sum across both Claude calls, and `timestamp` near now

#### Scenario: Successful synthesis inserts one row
- **WHEN** a synthesis run completes successfully for project `P`
- **THEN** exactly one `api_token_usage` row exists with `projectId=P`, `operation='synthesis'`, `provider='claude'`, the model used, and the streamed usage totals

#### Scenario: Failed Claude call still inserts a zero-token row
- **WHEN** an Anthropic call throws inside a search or synthesis operation
- **THEN** an `api_token_usage` row is inserted with `inputTokens=0`, `outputTokens=0`, and the configured model

### Requirement: GET token-usage endpoint returns paginated events
The API SHALL expose `GET /v1/projects/:projectId/analytics/token-usage?page=<n>` returning JSON `{ items, page, pageSize, total }` where `pageSize` is fixed at 20, `page` is 1-indexed (default `1`), and `items` is ordered by `timestamp DESC, id DESC`. Each item SHALL include `id`, `operation`, `provider`, `model`, `inputTokens`, `outputTokens`, and `timestamp` (ISO 8601).

#### Scenario: First page returns latest 20 events
- **WHEN** a caller requests `GET /v1/projects/:projectId/analytics/token-usage` with no `page` parameter
- **AND** the project has 25 events
- **THEN** the response contains the 20 most recent events sorted latest-first, `page=1`, `pageSize=20`, `total=25`

#### Scenario: Second page returns remaining events
- **WHEN** a caller requests `?page=2` for a project with 25 events
- **THEN** the response contains the 5 oldest events, `page=2`, `pageSize=20`, `total=25`

#### Scenario: Empty project returns empty list
- **WHEN** a caller requests the endpoint for a project with no recorded events
- **THEN** the response is `{ items: [], page: 1, pageSize: 20, total: 0 }`

### Requirement: Token-usage endpoint is readable by all org members
Any authenticated user that belongs to the org owning the project SHALL be allowed to read `GET /v1/projects/:projectId/analytics/token-usage`. Users outside the org SHALL receive 403.

#### Scenario: Org member can read
- **WHEN** a user who is a member of the project's org calls the endpoint
- **THEN** the API returns 200 with the paginated event list

#### Scenario: Non-member is rejected
- **WHEN** a user who is not a member of the project's org calls the endpoint
- **THEN** the API returns 403 and no data is leaked

### Requirement: Console Analytics button and page
The console SHALL render an `Analytics` button on the project detail page that navigates to `/orgs/:orgSlug/projects/:projectSlug/analytics`. That route SHALL render a plain HTML table with columns Date, Operation, Model, Input Tokens, Output Tokens, plus pagination controls for the previous/next page of 20 rows. No charts or graphs SHALL be rendered.

#### Scenario: Button navigates to analytics page
- **WHEN** an authenticated org member clicks `Analytics` on the project page
- **THEN** the console navigates to `/orgs/:orgSlug/projects/:projectSlug/analytics`

#### Scenario: Analytics page renders paginated table
- **WHEN** the analytics page loads for a project with events
- **THEN** it fetches page 1 from `GET /v1/projects/:projectId/analytics/token-usage` and renders one table row per event, latest first

#### Scenario: Pagination controls advance the page
- **WHEN** the user clicks the Next button on page 1 of a project with more than 20 events
- **THEN** the page fetches `?page=2` and re-renders the table with the next 20 rows
