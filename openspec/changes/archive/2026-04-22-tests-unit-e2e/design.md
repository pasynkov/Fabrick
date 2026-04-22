## Context

Fabrick consists of three applications: NestJS API, CLI (nest-commander), MCP server. Partial test coverage exists in CLI (api.service, credentials.service) and MCP (api-client, index). API has no tests. Jest is already configured in each application, but without unit/e2e config separation.

E2e tests for the API require a real PostgreSQL (TypeORM + migrations). All other external dependencies (Blob Storage, Service Bus, Anthropic) are mocked via jest.mock.

## Goals / Non-Goals

**Goals:**
- Unit tests for all API services and controllers
- Integration/e2e tests for API via `supertest` — real PostgreSQL, everything else mocked
- Extended CLI unit tests (init, push, login)
- MCP tool handler coverage
- Separate jest configs: `test:unit` (fast, no infra) and `test:e2e` (postgres sidecar)
- Parallel e2e execution across components

**Non-Goals:**
- Full E2E user journey (separate change `user-journey-e2e`)
- CI/CD pipeline (separate change `cicd-pipeline`)
- Coverage targets / thresholds
- Synthesis worker tests (separate component, tested in user journey)

## Decisions

### Jest config structure in API

Current `jest.config.js` covers only `*.spec.ts` from `src/`. Need a second config for e2e:

```
jest.config.js        ← unit (*.spec.ts, src/, no postgres)
jest.e2e.config.js    ← e2e (*.e2e.ts, test/, with postgres)
```

`package.json` scripts:
```json
"test:unit": "jest",
"test:e2e": "jest --config jest.e2e.config.js",
"test": "jest && jest --config jest.e2e.config.js"
```

**Why not a single config with testPathPattern?** Separate configs allow different `globalSetup`/`globalTeardown` for e2e (running migrations) without affecting unit tests.

### API e2e tests via supertest

NestJS Testing module + supertest — standard pattern:

```ts
// test/auth.e2e.ts
const app = await NestFactory.create(AppModule);
await app.init();
const server = app.getHttpServer();
await request(server).post('/auth/register').send({...}).expect(201);
```

`AppModule` uses real postgres (from env), Storage and Queue services mocked via `overrideProvider`.

**Why not a separate TestApp with minimal modules?** Real `AppModule` guarantees migrations ran and all modules are compatible.

### Mock strategy for external services

```ts
// in e2e: mock StorageService and QueueService at module level
.overrideProvider(StorageService).useValue({ putObject: jest.fn(), getObject: jest.fn(), listObjects: jest.fn() })
.overrideProvider(QUEUE_SERVICE).useValue({ publish: jest.fn(), subscribe: jest.fn() })
```

This verifies the contract: API correctly accepts request, validates, writes to DB — but does not verify real blob upload.

### PostgreSQL for e2e

Test database: separate (`fabrick_test`), created via `createDatabase` utility before tests. Migrations run via TypeORM `DataSource.runMigrations()` in `globalSetup`.

```ts
// test/setup.ts (globalSetup)
const ds = new DataSource({ ...config, database: 'fabrick_test' });
await ds.initialize();
await ds.runMigrations();
await ds.destroy();
```

In CI — postgres sidecar in GitHub Actions `services:`, env vars via `DB_HOST=localhost`.

### CLI e2e approach

CLI commands tested via mocked `fetch` (pattern already exists in api.service.spec.ts). No real HTTP needed — API contracts verified by API tests. Each command test verifies:
- Input parsing (flags, args)
- Correct API endpoint called with expected payload
- Output format (stdout/stderr)

### MCP tool handler tests

Tool handlers tested via mocked `ApiClient`. Each handler test verifies:
- Correct `ApiClient` method invoked
- Response mapped to expected MCP tool result format
- Error cases handled gracefully

## Risks / Trade-offs

- **Slow globalSetup** — creating DB and running migrations adds ~2-3s. Acceptable.
- **E2e parallelism** — if tests write to the same tables, isolation needed via `beforeEach` truncate or unique seed data. Solution: each test creates its own data, `afterEach` cleans up.
- **AppModule in tests** — real module pulls all dependencies. If something is not mocked — test fails on startup. This is a feature: immediately reveals unmocked dependencies.
- **CLI e2e** — tested via mocked `fetch` (pattern already in api.service.spec.ts). Real HTTP not needed — contract with API verified on the API tests side.
