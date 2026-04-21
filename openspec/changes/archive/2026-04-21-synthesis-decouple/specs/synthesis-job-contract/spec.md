## ADDED Requirements

### Requirement: Queue message carries all synthesis context
The synthesis job queue message SHALL include all data required to execute synthesis without any database lookup: project ID, org slug, project slug, and list of repos with slugs.

#### Scenario: API publishes enriched message
- **WHEN** synthesis is triggered for a project with 2 repos
- **THEN** queue message contains `{ projectId, orgSlug, projectSlug, repos: [{ id, slug }, { id, slug }] }`

### Requirement: Queue message includes capability token for callback auth
API SHALL generate a short-lived JWT (`scope: "synth-callback"`, `sub: projectId`, `exp: now+1h`) at dispatch time and include it as `callbackToken` in the queue message. No new env vars required — reuses existing `JWT_SECRET`.

#### Scenario: Capability token included in message
- **WHEN** API dispatches synthesis job for project `abc`
- **THEN** queue message contains `callbackToken` signed with API's `JWT_SECRET` with `{ sub: "abc", scope: "synth-callback" }`

### Requirement: Synthesis reports status via HTTP callback using capability token
On job completion (success or failure), synthesis SHALL POST to `POST /internal/synthesis/status` with `{ projectId, status: "done"|"error", error?: string }` and `Authorization: Bearer <callbackToken>`. API SHALL validate JWT signature, `scope === "synth-callback"`, and `token.sub === body.projectId`.

#### Scenario: Successful synthesis callback
- **WHEN** synthesis completes successfully
- **THEN** API receives POST with valid token and `{ projectId, status: "done" }`, updates project `synthStatus` to `"done"`

#### Scenario: Failed synthesis callback
- **WHEN** synthesis throws an error
- **THEN** API receives POST with valid token and `{ projectId, status: "error", error: "<message>" }`, updates project `synthStatus` to `"error"`

#### Scenario: Callback with invalid token rejected
- **WHEN** callback arrives with missing, expired, or wrong-scope token
- **THEN** API returns 401, project status not updated
