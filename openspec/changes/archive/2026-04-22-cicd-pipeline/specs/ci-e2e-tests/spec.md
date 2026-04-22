## ADDED Requirements

### Requirement: E2e tests run on develop and release branches with PostgreSQL sidecar
The CI system SHALL run e2e integration tests for the API on every push to `develop` and `release/*` branches. Tests MUST use a real PostgreSQL service container. Azure services (Blob Storage, Service Bus) SHALL be mocked in test code — no Azure credentials required.

#### Scenario: Push to develop triggers e2e workflow
- **WHEN** a commit is pushed to `develop`
- **THEN** GitHub Actions starts a PostgreSQL service container and runs `npm run test:e2e` in the API application

#### Scenario: Push to release branch triggers e2e workflow
- **WHEN** a commit is pushed to a `release/*` branch
- **THEN** e2e tests run with PostgreSQL sidecar before the ephemeral staging workflow starts

#### Scenario: E2e tests fail if database migrations fail
- **WHEN** globalSetup fails to run migrations against the test database
- **THEN** the workflow fails with a clear error message before any test executes

#### Scenario: E2e tests run without Azure credentials
- **WHEN** the e2e workflow runs
- **THEN** no `AZURE_CREDENTIALS` or ARM secrets are present in the runner environment

### Requirement: E2e test results are reported as a separate status check from unit tests
The e2e workflow SHALL produce a distinct GitHub status check so developers can differentiate unit test failures from e2e failures.

#### Scenario: Status checks are distinguishable
- **WHEN** both CI workflows run on the same commit
- **THEN** GitHub shows two separate status checks: one for unit tests, one for e2e tests
