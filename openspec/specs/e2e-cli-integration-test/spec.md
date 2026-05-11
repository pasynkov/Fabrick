## ADDED Requirements

### Requirement: CLI integration test covers full data path
The CLI integration test suite SHALL verify the complete path from user registration through CLI login, init, push, and MCP read-back against a real running API and Azurite blob storage. No mocks SHALL be used in the integration test. The test SHALL be defined in `applications/cli/test/integration.e2e.spec.ts` and run via `npm run test:e2e` using `jest.e2e.config.js`.

#### Scenario: Full integration test passes against real API and Azurite
- **WHEN** `npm run test:e2e` is executed in `applications/cli`
- **AND** an API server is running on `http://localhost:3000`
- **AND** Azurite blob endpoint is available at `http://127.0.0.1:10000/devstoreaccount1`
- **THEN** all integration test assertions pass with exit code 0

### Requirement: Test setup registers a user and provisions org/project/repo via HTTP
The integration test SHALL use direct HTTP calls (fetch) in `beforeAll` to register a user, obtain a CLI token, create an org, create a project, and find-or-create a repo. It SHALL also obtain an MCP token for the MCP step. No pre-seeded data or manual setup SHALL be required.

#### Scenario: Setup produces a valid CLI token
- **WHEN** the test calls `POST /auth/register` then `POST /auth/cli-token`
- **THEN** a `fbrk_`-prefixed token is returned and used for subsequent CLI and API calls

#### Scenario: Setup produces a valid MCP token with org and project claims
- **WHEN** the test calls `POST /auth/mcp-token` with orgSlug, projectSlug, and repoId
- **THEN** a `fbrk_`-prefixed MCP token is returned containing `org` and `project` JWT claims

### Requirement: CLI login integration test verifies credentials file written
The integration test SHALL execute `fabrick login --token <cliToken>` as a subprocess and assert that `.fabrick/credentials.yaml` is written in the test's working directory with the correct token and api_url.

#### Scenario: fabrick login --token writes credentials.yaml
- **WHEN** `fabrick login --token <cliToken>` subprocess exits with code 0
- **THEN** `.fabrick/credentials.yaml` exists in the test working directory
- **AND** it contains the correct token and `api_url: http://localhost:3000`

### Requirement: CLI init integration test verifies config file written
The integration test SHALL execute `fabrick init --non-interactive --org <slug> --project <slug>` and assert that `.fabrick/config.yaml` is written with the correct `repo_id`.

#### Scenario: fabrick init --non-interactive writes config.yaml
- **WHEN** `fabrick init --non-interactive --org <slug> --project <slug>` subprocess exits with code 0
- **THEN** `.fabrick/config.yaml` exists in the test working directory
- **AND** `repo_id` in the config matches the repo created during setup

### Requirement: CLI push integration test verifies upload succeeds
The integration test SHALL create a `.fabrick/context/` directory with a mock file, execute `fabrick push`, and assert the subprocess exits with code 0.

#### Scenario: fabrick push exits 0 with mock context
- **WHEN** `.fabrick/context/mock.md` exists with content
- **AND** `fabrick push` subprocess is executed
- **THEN** the process exits with code 0
- **AND** the API accepted the upload (200 response implicitly confirmed by exit code)

### Requirement: MCP stdio integration test verifies synthesis file read-back
The integration test SHALL upload a mock synthesis file directly to Azurite (`orgSlug` container, `projectSlug/synthesis/index.md` key), then spawn the MCP server subprocess with `FABRICK_TOKEN` and `FABRICK_API_URL` env vars, drive the stdio JSON-RPC protocol (initialize → initialized notification → tools/call get_synthesis_index), and assert the response contains the mock content.

#### Scenario: MCP get_synthesis_index returns mock synthesis content
- **WHEN** `index.md` has been uploaded to Azurite at `projectSlug/synthesis/index.md` in the `orgSlug` container
- **AND** MCP server is spawned with a valid MCP token and API URL
- **AND** the test sends initialize, initialized, and tools/call get_synthesis_index frames via stdin
- **THEN** the tools/call response contains `content[0].text` equal to the uploaded mock content

#### Scenario: MCP initialize handshake completes successfully
- **WHEN** the test sends `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}`
- **THEN** the MCP server responds with a result containing `protocolVersion` and `serverInfo`
