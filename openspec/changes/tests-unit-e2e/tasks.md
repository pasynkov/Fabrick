## 1. API Jest Config Split

- [ ] 1.1 Create `jest.e2e.config.js` in `applications/backend/api/` pointing to `test/**/*.e2e.ts` with globalSetup
- [ ] 1.2 Update `applications/backend/api/package.json` with `test:unit`, `test:e2e`, `test` scripts

## 2. API E2e Infrastructure

- [ ] 2.1 Create `applications/backend/api/test/setup.ts` (globalSetup) — connect to `fabrick_test` DB, run migrations, destroy
- [ ] 2.2 Create `applications/backend/api/test/teardown.ts` (globalTeardown) — drop test database
- [ ] 2.3 Add `@nestjs/testing` and `supertest` to dev dependencies

## 3. API Unit Tests

- [ ] 3.1 Write `auth.service.spec.ts` — register (hash + save + JWT), login (verify + JWT), error cases
- [ ] 3.2 Write `orgs.service.spec.ts` — create, findById, membership checks
- [ ] 3.3 Write `repos.service.spec.ts` — create, findById, access control
- [ ] 3.4 Write `context.service.spec.ts` — upload calls StorageService.putObject with correct key
- [ ] 3.5 Write `synthesis.service.spec.ts` — trigger calls QueueService.publish with correct job payload
- [ ] 3.6 Write `auth.controller.spec.ts` — POST /auth/register and /auth/login delegation and response shape
- [ ] 3.7 Write controller spec files for orgs, repos, context, synthesis controllers

## 4. API E2e Tests

- [ ] 4.1 Write `test/auth.e2e.ts` — register + login flow against real DB, verify JWT returned
- [ ] 4.2 Write `test/orgs.e2e.ts` — create org, list orgs, auth required
- [ ] 4.3 Write `test/repos.e2e.ts` — create repo under org, access control
- [ ] 4.4 Write `test/context.e2e.ts` — upload context, verify DB metadata, StorageService mock called
- [ ] 4.5 Write `test/synthesis.e2e.ts` — trigger synthesis, verify QueueService mock called with correct payload
- [ ] 4.6 Add `beforeEach`/`afterEach` truncate helpers to each e2e test file

## 5. CLI Unit Tests

- [ ] 5.1 Write `login.command.spec.ts` — verify ApiService.post('/auth/login') called, token stored
- [ ] 5.2 Write `init.command.spec.ts` — verify org + repo creation API calls in sequence
- [ ] 5.3 Write `push.command.spec.ts` — verify zip assembled and context upload API called
- [ ] 5.4 Verify all existing CLI unit tests still pass after additions

## 6. MCP Unit Tests

- [ ] 6.1 Extend `api-client.test.ts` — cover all methods, auth header, error on non-2xx
- [ ] 6.2 Write tool handler tests for each MCP tool — correct ApiClient method called, result mapped to MCP format, error case returns isError result
- [ ] 6.3 Verify all existing MCP tests still pass after additions

## 7. Verification

- [ ] 7.1 Run `npm run test:unit` in API — all unit tests pass without running postgres
- [ ] 7.2 Run `npm run test:e2e` in API with postgres sidecar — all e2e tests pass
- [ ] 7.3 Run `npm test` in CLI — all tests pass
- [ ] 7.4 Run `npm test` in MCP — all tests pass
