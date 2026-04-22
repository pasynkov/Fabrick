## 1. API Jest Config Split

- [x] 1.1 Create `jest.e2e.config.js` in `applications/backend/api/` pointing to `test/**/*.e2e.ts` with globalSetup
- [x] 1.2 Update `applications/backend/api/package.json` with `test:unit`, `test:e2e`, `test` scripts

## 2. API E2e Infrastructure

- [x] 2.1 Create `applications/backend/api/test/setup.ts` (globalSetup) — connect to `fabrick_test` DB, run migrations, destroy
- [x] 2.2 Create `applications/backend/api/test/teardown.ts` (globalTeardown) — drop test database
- [x] 2.3 Add `@nestjs/testing` and `supertest` to dev dependencies

## 3. API Unit Tests

- [x] 3.1 Write `auth.service.spec.ts` — register (hash + save + JWT), login (verify + JWT), error cases
- [x] 3.2 Write `orgs.service.spec.ts` — create, findById, membership checks
- [x] 3.3 Write `repos.service.spec.ts` — create, findById, access control
- [x] 3.4 Write `context.service.spec.ts` — upload calls StorageService.putObject with correct key
- [x] 3.5 Write `synthesis.service.spec.ts` — trigger calls QueueService.publish with correct job payload
- [x] 3.6 Write `auth.controller.spec.ts` — POST /auth/register and /auth/login delegation and response shape
- [x] 3.7 Write controller spec files for orgs, repos, context, synthesis controllers

## 4. API E2e Tests

- [x] 4.1 Write `test/auth.e2e.ts` — register + login flow against real DB, verify JWT returned
- [x] 4.2 Write `test/orgs.e2e.ts` — create org, list orgs, auth required
- [x] 4.3 Write `test/repos.e2e.ts` — create repo under org, access control
- [x] 4.4 Write `test/context.e2e.ts` — upload context, verify DB metadata, StorageService mock called
- [x] 4.5 Write `test/synthesis.e2e.ts` — trigger synthesis, verify QueueService mock called with correct payload
- [x] 4.6 Add `beforeEach`/`afterEach` truncate helpers to each e2e test file

## 5. CLI Unit Tests

- [x] 5.1 Write `login.command.spec.ts` — verify ApiService.post('/auth/login') called, token stored
- [x] 5.2 Write `init.command.spec.ts` — verify org + repo creation API calls in sequence
- [x] 5.3 Write `push.command.spec.ts` — verify zip assembled and context upload API called
- [x] 5.4 Verify all existing CLI unit tests still pass after additions

## 6. MCP Unit Tests

- [x] 6.1 Extend `api-client.test.ts` — cover all methods, auth header, error on non-2xx
- [x] 6.2 Write tool handler tests for each MCP tool — correct ApiClient method called, result mapped to MCP format, error case returns isError result
- [x] 6.3 Verify all existing MCP tests still pass after additions

## 7. Verification

- [x] 7.1 Run `npm run test:unit` in API — all unit tests pass without running postgres
- [x] 7.2 Run `npm run test:e2e` in API with postgres sidecar — all e2e tests pass
- [x] 7.3 Run `npm test` in CLI — all tests pass
- [x] 7.4 Run `npm test` in MCP — all tests pass
