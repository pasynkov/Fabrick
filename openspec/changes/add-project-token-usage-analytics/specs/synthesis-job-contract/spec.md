## MODIFIED Requirements

### Requirement: Synthesis reports status via HTTP callback using capability token
On job completion (success or failure), synthesis SHALL POST to `POST /internal/synthesis/status` with `{ projectId, status: "done"|"error", error?: string, usage?: { model: string, inputTokens: number, outputTokens: number } }` and `Authorization: Bearer <callbackToken>`. API SHALL validate JWT signature, `scope === "synth-callback"`, and `token.sub === body.projectId`. When `usage` is present, the API SHALL insert one `api_token_usage` row (operation `synthesis`, provider `claude`) in the same handler that updates `synthStatus`. On failure callbacks, the worker SHALL still include `usage` with `inputTokens: 0`, `outputTokens: 0` and the configured model. The `usage` field is OPTIONAL for backwards compatibility — callbacks without it SHALL be accepted and SHALL NOT insert an analytics row.

#### Scenario: Successful synthesis callback inserts analytics row
- **WHEN** synthesis completes successfully and POSTs `{ projectId, status: "done", usage: { model, inputTokens: 1000, outputTokens: 4000 } }` with a valid token
- **THEN** API updates project `synthStatus` to `"done"` AND inserts one `api_token_usage` row with the supplied usage

#### Scenario: Failed synthesis callback inserts zero-token row
- **WHEN** synthesis fails and POSTs `{ projectId, status: "error", error: "...", usage: { model, inputTokens: 0, outputTokens: 0 } }`
- **THEN** API updates `synthStatus` to `"error"` AND inserts one `api_token_usage` row with zero tokens

#### Scenario: Callback without usage stays backwards-compatible
- **WHEN** an older worker POSTs `{ projectId, status: "done" }` without `usage`
- **THEN** API updates `synthStatus` to `"done"` and does NOT insert an analytics row

#### Scenario: Callback with invalid token rejected
- **WHEN** callback arrives with missing, expired, or wrong-scope token
- **THEN** API returns 401, project status not updated, no analytics row inserted
