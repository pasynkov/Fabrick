## Why

Project members currently have no visibility into how many Claude API tokens their projects consume during search and synthesis operations. Without this data, teams cannot reason about cost, plan capacity, or detect runaway usage. A minimal first-version analytics view answers the basic question "how much have we spent on tokens lately?" per project.

## What Changes

- Persist token usage for every Claude API call made on behalf of a project, capturing operation type (search or synthesis), input tokens, output tokens, provider, and timestamp.
- Add a `token_usage` table and TypeORM entity, plus a migration to create it with an index on `(project_id, created_at DESC)`.
- Capture token usage from the Anthropic response inside the search service for both API calls (slug selection and answer generation), one row per call.
- Capture token usage inside the synthesis worker for each Claude API call it makes, attributed to the originating project.
- Expose a new authenticated backend endpoint `GET /v1/projects/:id/token-analytics` returning per-call rows for the project (default window: last 30 days).
- Add an `analytics` method to the console API client and a new `Analytics` page/component that renders a table with columns: Date, Operation, Input Tokens, Output Tokens, Total, Provider.
- Add an "Analytics" button on the project page that navigates to the new analytics view.

## Capabilities

### New Capabilities
- `project-token-analytics`: Recording per-call Claude API token usage for a project and exposing it through a backend endpoint and a console table view.

### Modified Capabilities
- `fabrick-search`: Search service must record token usage from each Anthropic response into the new `token_usage` table.
- `project-wiki-synthesis`: Synthesis worker must record token usage from each Claude API call it performs, attributed to the project being synthesized.

## Impact

- Backend: new TypeORM entity, repository, service, controller, and migration; modifications to the search service and synthesis worker to write usage rows; new route registered under the existing v1 project routes.
- Frontend: new console route/page, new API client method, new button on the project detail page.
- Database: new `token_usage` table with foreign key to `projects(id) ON DELETE CASCADE`.
- No breaking changes; existing endpoints and entities are unchanged.
