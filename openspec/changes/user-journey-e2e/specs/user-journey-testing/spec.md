## ADDED Requirements

### Requirement: Journey test covers the complete Fabrick user flow end-to-end
The user-journey test suite SHALL verify the full product flow against a real Azure environment: user registration → org creation → repo creation → context push → synthesis trigger → synthesis completion → output retrieval. All steps MUST use real Azure services with no mocking.

#### Scenario: Full flow completes successfully
- **WHEN** the journey test runs against a live ephemeral Azure environment
- **THEN** a new user is registered, org and repo created, context uploaded, synthesis triggered, synthesis completes within 100 seconds, and the output blob is retrievable

#### Scenario: Each test run uses a unique user identity
- **WHEN** the journey test starts
- **THEN** it registers a new user with a UUID-based email to avoid conflicts with other runs or leftover data

### Requirement: Journey tests drive the CLI binary for user-facing operations
The test suite SHALL use the `@fabrick/cli` binary (built from local source) to drive CLI commands (login, init, push) rather than calling the API directly. This verifies the full stack including CLI argument parsing, credential storage, and API delegation.

#### Scenario: login command stores credentials for subsequent CLI commands
- **WHEN** `fabrick login` is called with test user credentials
- **THEN** subsequent `fabrick init` and `fabrick push` commands succeed without re-authenticating

#### Scenario: push command uploads context successfully
- **WHEN** `fabrick push` is called in a directory with test fixture files
- **THEN** the command exits 0 and the context is retrievable via API

### Requirement: Synthesis completion is verified by polling with timeout
The test suite SHALL poll the synthesis status endpoint until completion or a configurable timeout. Timeout MUST be at least 100 seconds to account for Container App cold start. The test SHALL fail with a descriptive timeout message if synthesis does not complete in time.

#### Scenario: Synthesis completes within timeout
- **WHEN** synthesis is triggered and Container App processes the job
- **THEN** polling detects `status: completed` within 100 seconds and the test passes

#### Scenario: Synthesis times out — test fails with clear message
- **WHEN** synthesis does not reach `status: completed` within the timeout
- **THEN** the test fails with a message indicating the last observed status and elapsed time

### Requirement: Journey test suite is a standalone package in tests/user-journey/
The test suite SHALL be located at `tests/user-journey/` as a standalone Node.js package with its own `package.json`. It MUST NOT be part of the application workspace packages to avoid coupling test dependencies to deployable artifacts.

#### Scenario: Journey tests installable independently
- **WHEN** `npm install` is run in `tests/user-journey/`
- **THEN** all test dependencies are installed without affecting application packages

#### Scenario: Journey tests configurable via environment variables
- **WHEN** `API_URL` environment variable is set to the staging API endpoint
- **THEN** all test HTTP calls and CLI invocations target that endpoint
