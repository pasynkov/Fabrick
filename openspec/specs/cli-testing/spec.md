### Requirement: CLI package exposes a test:e2e script for integration tests
The CLI `package.json` SHALL include a `"test:e2e"` script that runs Jest with `jest.e2e.config.js`. This config SHALL target `test/**/*.e2e.spec.ts` files with a long timeout (60 seconds) and `testEnvironment: node`.

#### Scenario: test:e2e script runs integration tests
- **WHEN** `npm run test:e2e` is executed in `applications/cli`
- **THEN** Jest runs files matching `test/**/*.e2e.spec.ts` using `jest.e2e.config.js`

#### Scenario: test:e2e does not run unit tests
- **WHEN** `npm run test:e2e` is executed
- **THEN** files matching `**/*.spec.ts` in `src/` are NOT included in the run

### Requirement: Integration tests use @azure/storage-blob for direct Azurite writes
The CLI package SHALL include `@azure/storage-blob` as a dev dependency so the integration test can upload mock synthesis files directly to Azurite without going through the API.

#### Scenario: Direct blob upload in integration test setup
- **WHEN** `beforeAll` in `integration.e2e.spec.ts` calls `BlobServiceClient.fromConnectionString(azuriteConnStr)`
- **THEN** the client connects to Azurite and `uploadData` succeeds without errors

### Requirement: Unit tests cover CLI command input parsing and API delegation
The CLI SHALL have unit tests for all commands (init, push, login). Tests MUST mock fetch (or ApiService) so no real HTTP is made. Tests SHALL verify that commands parse flags/args correctly and call the correct API endpoint with the correct payload.

#### Scenario: login command sends credentials to auth endpoint
- **WHEN** `fabrick login` is invoked with email and password flags
- **THEN** ApiService.post('/auth/login') is called with the provided credentials and the returned token is stored via CredentialsService

#### Scenario: init command calls org and repo creation endpoints
- **WHEN** `fabrick init` is invoked with org name and repo name flags
- **THEN** ApiService.post('/orgs') and ApiService.post('/repos') are called in sequence with correct bodies

#### Scenario: push command assembles zip and uploads context
- **WHEN** `fabrick push` is invoked in a directory with files
- **THEN** the command creates a zip of the directory contents and calls ApiService to upload it to the correct repo context endpoint

#### Scenario: Command prints readable error on API failure
- **WHEN** ApiService throws an error (e.g., 401 Unauthorized)
- **THEN** command prints a user-friendly error message to stderr and exits with non-zero code

#### Scenario: Command prints readable error when API is unreachable
- **WHEN** fetch throws a network error (ECONNREFUSED)
- **THEN** command prints "Cannot reach API at <url>: <cause>" to stderr and exits non-zero

### Requirement: CLI unit tests extend existing coverage patterns
The CLI test suite SHALL follow the patterns already established in `api.service.spec.ts` and `credentials.service.spec.ts`. New tests MUST use the same mock structure and assertion style as existing tests.

#### Scenario: New command tests use existing jest.mock pattern for fetch
- **WHEN** a new command spec file is added
- **THEN** it mocks global fetch using the same pattern as api.service.spec.ts

#### Scenario: Existing tests remain passing after extensions
- **WHEN** `npm run test:unit` is run in the CLI application
- **THEN** both existing and new test files pass without modification to existing specs

### Requirement: CLI tests run on Node.js 24 runtime
All CLI tests SHALL execute on Node.js 24 runtime environment to ensure compatibility with the target runtime environment used in production.

#### Scenario: Unit tests execute on Node.js 24
- **WHEN** `npm test` is executed in Node.js 24 environment
- **THEN** all CLI unit tests pass without runtime version compatibility issues

#### Scenario: Jest mocks work correctly on Node.js 24
- **WHEN** CLI command tests run with global fetch mocked
- **THEN** all mock patterns from existing test files work without modification on Node.js 24

#### Scenario: CI pipeline runs CLI tests on Node.js 24
- **WHEN** GitHub Actions ci-unit.yml workflow executes  
- **THEN** test-cli job uses `actions/setup-node@v4` with `node-version: '24'` and all tests pass
