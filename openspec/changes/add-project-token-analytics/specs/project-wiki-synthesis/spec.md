## ADDED Requirements

### Requirement: Synthesis worker records token usage for each Claude call

The synthesis worker SHALL record token usage for every Claude API call it performs while processing a project synthesis job. For each call, the worker MUST persist a row in `token_usage` with `operation = 'synthesis'`, the project id of the job being processed, the input and output token counts from the Anthropic response, and `provider = 'claude'`.

#### Scenario: Single Claude call during synthesis records a row

- **WHEN** the synthesis worker completes a Claude API call as part of processing a synthesis job for project `P`
- **THEN** the worker writes a `token_usage` row with `operation = 'synthesis'`, `projectId = P`, the input/output token counts from the Anthropic response, and `provider = 'claude'`

#### Scenario: Multiple Claude calls in one synthesis job produce multiple rows

- **WHEN** the synthesis worker performs N Claude API calls while processing a single synthesis job
- **THEN** the worker writes N separate `token_usage` rows, all attributed to the same project id

#### Scenario: Usage recording does not abort the synthesis job

- **WHEN** writing a `token_usage` row fails for any reason
- **THEN** the worker logs the failure and continues processing the synthesis job
