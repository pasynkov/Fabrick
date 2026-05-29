## ADDED Requirements

### Requirement: Search accepts an optional reasoning flag

The search endpoint SHALL accept an optional `reasoning` boolean in the request body. The default value is `false`. The flag MUST be forwarded from the controller through the service to `SearchImpl`.

#### Scenario: Request omits reasoning flag

- **WHEN** a client posts `{ "question": "..." }` without a `reasoning` field
- **THEN** the search runs with `reasoning = false`

#### Scenario: Request explicitly enables reasoning

- **WHEN** a client posts `{ "question": "...", "reasoning": true }`
- **THEN** the search runs with `reasoning = true` and the system prompt is instructed to emit a `REASONING:` section

### Requirement: Search response always returns a concise answer and optionally a reasoning section

The search response body SHALL be `{ answer: string, reasoning?: string, sources: string[] }`. `answer` MUST contain the concise paragraph emitted by the model under the `BRIEF:` marker. `reasoning` MUST be present only when the model emitted a `REASONING:` section.

#### Scenario: Reasoning not requested

- **WHEN** the model returns a response with a `BRIEF:` block and a `SOURCES:` line but no `REASONING:` block
- **THEN** the response body contains `answer` set to the brief paragraph, `sources` populated, and no `reasoning` field

#### Scenario: Reasoning requested and returned

- **WHEN** the model returns a response with `BRIEF:`, `REASONING:`, and `SOURCES:` sections
- **THEN** the response body contains `answer` set to the brief paragraph, `reasoning` set to the reasoning section, and `sources` populated

#### Scenario: Model fails to emit BRIEF marker

- **WHEN** the model returns text without a `BRIEF:` marker but with a `SOURCES:` line
- **THEN** the response body contains `answer` set to the full text (minus the `SOURCES:` line), no `reasoning` field, and the service logs a warning

### Requirement: Search records analytics for every request

The search service SHALL persist one row in `search_requests` per `/search` request and one row in `token_usage` per Anthropic call performed during the agentic tool-use loop. Each `token_usage` row written by search MUST link to its parent via `search_request_id`.

#### Scenario: Successful search persists aggregate and per-call rows

- **WHEN** a search completes after performing N Anthropic calls
- **THEN** the service inserts one `search_requests` row with the question, `reasoning_requested`, brief, reasoning (if produced), sources, iters, pages read, total input/output tokens, duration ms, and stop reason
- **AND** inserts N `token_usage` rows with `operation = 'search'`, the project id, `search_request_id` set to the new aggregate row, and the per-call token counts

#### Scenario: Analytics write failure does not break the search response

- **WHEN** inserting the `search_requests` row or any `token_usage` row fails
- **THEN** the service logs the failure and still returns the search response to the caller as if persistence had succeeded
