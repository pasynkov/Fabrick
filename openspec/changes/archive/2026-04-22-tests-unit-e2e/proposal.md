## Why

Fabrick has many failure points (API, CLI, MCP, PostgreSQL, Blob Storage, Service Bus, synthesis) with no test coverage. Without tests, safe iteration and CI/CD pipeline construction are impossible.

## What Changes

- Add unit tests for API (auth, orgs, repos, context upload, synthesis trigger)
- Add unit tests for MCP (api-client, tool handlers)
- Extend existing CLI unit tests (init, push, login commands)
- Add integration/e2e tests for API — real PostgreSQL, all other dependencies mocked (Blob Storage, Service Bus, Anthropic)
- Add integration tests for CLI — verify input/output contracts of commands
- Configure jest for parallel e2e test execution
- Add npm scripts: `test:unit`, `test:e2e`, `test:all`

## Capabilities

### New Capabilities

- `api-testing`: Unit and integration tests for NestJS API — coverage of all controllers and services
- `cli-testing`: Unit and integration tests for CLI commands — contract verification with API
- `mcp-testing`: Unit tests for MCP server — tool handlers and api-client

### Modified Capabilities

_(no requirement changes to existing capabilities)_

## Impact

- `applications/backend/api/src/**/*.spec.ts` — new unit tests
- `applications/backend/api/test/**/*.e2e.ts` — new integration tests
- `applications/cli/src/**/*.spec.ts` — extensions + new tests
- `applications/mcp/src/**/*.test.ts` — extensions of existing tests
- `applications/backend/api/jest.config.js` — separate configs for unit/e2e
- New dependencies: `@nestjs/testing`, `supertest` for e2e
- E2e tests require PostgreSQL sidecar (in CI — via GitHub Actions `services:`)
