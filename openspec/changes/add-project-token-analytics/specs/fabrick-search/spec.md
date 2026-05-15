## ADDED Requirements

### Requirement: Search service records token usage for each Claude call

The search service SHALL record token usage for every Claude API call it performs (currently the slug-selection call and the answer-generation call). For each call, the service MUST persist a row in `token_usage` with `operation = 'search'`, the project id of the search request, the input and output token counts from the Anthropic response, and `provider = 'claude'`.

#### Scenario: Slug-selection call produces a usage row

- **WHEN** the search service completes the slug-selection Claude call for a project search request
- **THEN** the service writes a `token_usage` row with `operation = 'search'`, the request's project id, and the input/output token counts from the Anthropic response

#### Scenario: Answer-generation call produces a usage row

- **WHEN** the search service completes the answer-generation Claude call for the same project search request
- **THEN** the service writes a second `token_usage` row with `operation = 'search'`, the same project id, and the input/output token counts from that response

#### Scenario: Usage recording does not break the search response

- **WHEN** writing a `token_usage` row fails for any reason
- **THEN** the search service logs the failure and still returns the search response to the caller as if usage recording had succeeded
