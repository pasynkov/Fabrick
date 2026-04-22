## ADDED Requirements

### Requirement: Unit tests run automatically on every pull request
The CI system SHALL run unit tests for all applications (API, CLI, MCP) on every pull request targeting any branch. Tests MUST complete without any external infrastructure. Pull request status check MUST be marked failed if any test fails.

#### Scenario: PR triggers unit test workflow
- **WHEN** a pull request is opened or updated
- **THEN** GitHub Actions runs `npm run test:unit` for API, CLI, and MCP applications in parallel

#### Scenario: Failed unit test blocks PR merge
- **WHEN** any unit test fails in the workflow
- **THEN** the GitHub status check is marked as failed and the PR cannot be merged to protected branches

#### Scenario: Unit tests run without Azure credentials
- **WHEN** the unit test workflow runs
- **THEN** no Azure secrets or service connections are required — all external dependencies are mocked in test code

### Requirement: Unit tests run on push to develop
The CI system SHALL also run unit tests on every push to the `develop` branch to catch failures from merges.

#### Scenario: Push to develop triggers unit tests
- **WHEN** a commit is pushed to the `develop` branch
- **THEN** the unit test workflow runs and results are visible in the GitHub Actions tab
