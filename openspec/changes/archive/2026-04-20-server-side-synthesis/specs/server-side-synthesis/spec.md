## ADDED Requirements

### Requirement: Synthesis can be triggered per project
The system SHALL allow authenticated users to trigger architecture synthesis for a project via `POST /projects/:id/synthesis`. The endpoint SHALL return immediately with `{ status: "started" }` and run synthesis asynchronously.

#### Scenario: Trigger synthesis
- **WHEN** user sends `POST /projects/:id/synthesis` with valid auth
- **THEN** response is `{ status: "started" }` with HTTP 202
- **AND** synthesis runs asynchronously in the background

#### Scenario: Reject concurrent synthesis
- **WHEN** synthesis is already running for a project
- **AND** user sends `POST /projects/:id/synthesis`
- **THEN** response is HTTP 409 with `{ message: "Synthesis already running" }`

#### Scenario: Unauthorized trigger rejected
- **WHEN** request has no valid auth token
- **THEN** response is HTTP 401

### Requirement: Synthesis status is pollable
The system SHALL expose `GET /projects/:id/synthesis/status` returning the current synthesis state.

#### Scenario: Status returns current state
- **WHEN** user polls `GET /projects/:id/synthesis/status`
- **THEN** response includes `{ status: "idle" | "running" | "done" | "error" }`

#### Scenario: Error state includes message
- **WHEN** synthesis failed
- **THEN** status response includes `{ status: "error", error: "<reason>" }`

### Requirement: Synthesis reads all repo contexts from MinIO
During synthesis, the backend SHALL fetch all context files for all repos in the project from MinIO before calling the Anthropic API.

#### Scenario: All repo contexts assembled
- **WHEN** synthesis runs for a project with 2 repos
- **THEN** context files from both repos are included in the Anthropic prompt

### Requirement: Synthesis result stored as files in MinIO
The Anthropic response SHALL be parsed as JSON and each file stored individually in MinIO at `{orgSlug}/{projectSlug}/synthesis/{path}`.

#### Scenario: Files stored after synthesis
- **WHEN** synthesis completes successfully
- **THEN** `overview.md`, `index.md`, and per-app files exist in MinIO under `synthesis/` prefix

### Requirement: Synthesized files are retrievable
`GET /projects/:id/synthesis` SHALL return the list of synthesized files with their content.

#### Scenario: Retrieve synthesis result
- **WHEN** synthesis is done
- **AND** user calls `GET /projects/:id/synthesis`
- **THEN** response includes array of `{ path, content }` objects

#### Scenario: Not found when no synthesis yet
- **WHEN** synthesis has never run for a project
- **AND** user calls `GET /projects/:id/synthesis`
- **THEN** response is HTTP 404

### Requirement: Console shows synthesis controls
The project detail page SHALL show a "Run Synthesis" button and display synthesis status.

#### Scenario: Button triggers synthesis
- **WHEN** user clicks "Run Synthesis"
- **THEN** button shows loading state and polls status until done or error

#### Scenario: Done state shows result link
- **WHEN** synthesis status becomes "done"
- **THEN** console shows synthesis complete and allows viewing results
