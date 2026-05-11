## ADDED Requirements

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
