## Requirements

### Requirement: API deployable to Azure Functions Consumption plan
The NestJS API SHALL support deployment as an Azure HTTP Function using `@nestjs/azure-func-http`, with a dedicated entry point `main.azure.ts` that wraps `AppModule` via `AzureHttpAdapter`.

#### Scenario: Azure Functions entry point exists
- **WHEN** the API is built with `npm run build`
- **THEN** `dist/main.azure.js` is present alongside `dist/main.js`

#### Scenario: All HTTP routes handled
- **WHEN** any API route is called via the Azure Functions runtime
- **THEN** the request is routed through the NestJS router and returns the correct response

### Requirement: Local Express server unchanged
The existing `main.ts` Express entry point SHALL continue to work without modification. Both entry points SHALL coexist.

#### Scenario: docker-compose starts Express server
- **WHEN** `docker-compose up` is run in `applications/backend/`
- **THEN** the NestJS Express server is available on port 3000

#### Scenario: func start runs Functions locally
- **WHEN** `func start` is run in `applications/backend/api/` with `local.settings.json` present
- **THEN** the Azure Functions runtime starts and all routes are reachable via the Functions HTTP trigger

### Requirement: Functions runtime config present
`host.json` SHALL be present at `applications/backend/api/host.json` with extension bundle v4 and empty `routePrefix` so that NestJS route paths are used as-is.

#### Scenario: host.json present
- **WHEN** the API directory is inspected
- **THEN** `host.json` exists with `"version": "2.0"` and extension bundle `[4.*, 5.0.0)`

### Requirement: Local settings excluded from version control
`local.settings.json` SHALL be listed in `.gitignore` and SHALL NOT be committed.

#### Scenario: local.settings.json not tracked
- **WHEN** `git status` is run
- **THEN** `local.settings.json` is not shown as a tracked or staged file

### Requirement: TypeORM connection pool limited per instance
The TypeORM config SHALL set `extra: { max: 2 }` to limit PostgreSQL connections per Functions instance, preventing connection exhaustion under concurrent scaling.

#### Scenario: Pool size capped
- **WHEN** multiple concurrent Functions instances connect to PostgreSQL
- **THEN** each instance holds at most 2 connections

### Requirement: Azure Functions runtime uses Node.js 24
The Azure Functions deployment SHALL use Node.js 24 runtime environment to ensure consistency with local development and CI/CD environments.

#### Scenario: Azure Functions Node.js version configured
- **WHEN** Azure Functions app configuration is examined
- **THEN** the WEBSITE_NODE_DEFAULT_VERSION is set to support Node.js 24 (e.g., "~24" or "24.x")

#### Scenario: func start uses Node.js 24 locally
- **WHEN** `func start` is run in `applications/backend/api/` with Node.js 24 installed
- **THEN** the Azure Functions runtime starts successfully and all routes are reachable via the Functions HTTP trigger
