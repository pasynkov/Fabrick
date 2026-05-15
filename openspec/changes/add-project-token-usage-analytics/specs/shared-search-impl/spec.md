## ADDED Requirements

### Requirement: SearchImpl emits a token-usage event per search
After every `SearchImpl.search()` invocation — whether it completes successfully or throws — `SearchImpl` SHALL emit exactly one token-usage event for the calling project. The event SHALL sum `inputTokens` and `outputTokens` reported by the Anthropic SDK across the slug-selection and answer-generation calls. The recorded `model` SHALL be the model used for answer generation. The recorded `operation` SHALL be `search` and `provider` SHALL be `claude`. Emission SHALL go through an injected `TokenUsageRecorder` port so `SearchImpl` does not depend on DB infrastructure.

#### Scenario: Successful search emits combined usage
- **WHEN** `search()` completes successfully with slug-selection returning `usage={input:50, output:10}` and answer-generation returning `usage={input:200, output:300}`
- **THEN** `TokenUsageRecorder.record` is called once with `{ projectId, operation: 'search', provider: 'claude', model: <answer-model>, inputTokens: 250, outputTokens: 310 }`

#### Scenario: Failed search emits zero-token event
- **WHEN** the Anthropic call inside `search()` throws
- **THEN** `TokenUsageRecorder.record` is called once with `inputTokens: 0`, `outputTokens: 0`, and the configured model, and the original error is re-thrown

#### Scenario: Recorder failure does not break search
- **WHEN** `TokenUsageRecorder.record` throws
- **THEN** the search still returns its `{ answer, sources }` result and the recorder error is logged
