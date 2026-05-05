## Context

The CD release pipeline currently tests the API in isolation using NestJS in-process with mocked storage and queue. The CLI and MCP layers have no integration-level CI coverage. The API already exposes all endpoints needed for headless test setup (`POST /auth/register`, `POST /auth/cli-token`, `POST /auth/mcp-token`). The MCP server communicates via newline-delimited JSON-RPC over stdio — testable via subprocess spawn without any MCP client library.

## Goals / Non-Goals

**Goals:**
- Test the full data path: CLI login → init → push → blob storage → MCP read-back
- Run in CI without secrets or external services (Azurite replaces Azure Blob Storage)
- Keep test setup entirely API-driven (no DB seeding, no pre-provisioned accounts)
- Enable headless CLI use via flags (no browser, no prompts)

**Non-Goals:**
- Testing synthesis (async, requires Container Apps — out of scope for release CI)
- Testing the browser-based OAuth flow in CI
- Running MCP as a real Claude tool (testing via direct stdio subprocess is sufficient)

## Decisions

### D1: Azurite as blob storage emulator

Azurite (`mcr.microsoft.com/azure-storage/azurite`) runs as a GitHub Actions service container. Its default connection string is well-known and hardcoded — no secrets needed. The API's `StorageService` uses `AZURE_STORAGE_CONNECTION_STRING` and is transparent to the backend.

Alternative considered: mock storage at the module level (like existing e2e-api). Rejected — the point of this test is to exercise real blob I/O.

### D2: JWT_SECRET hardcoded in CI job

The e2e-cli job does not use `secrets.JWT_SECRET`. It sets `JWT_SECRET: ci-test-secret-not-for-prod` directly in the job env. This is safe: the JWT is ephemeral, tokens expire, and the test database is isolated. Avoids a secret dependency for a test-only job.

### D3: API runs standalone (`npm run start`) not as Azure Function

`main.ts` starts NestJS on port 3000 via Express. The Azure Function entrypoint is separate. For CI, we use `npm run build && npm run start &` and `wait-on` to poll `/health`. This matches how the existing e2e-api tests work conceptually but with a real HTTP server.

Alternative considered: NestJS in-process (like e2e-api). Rejected — CLI uses `fetch` to a real URL; in-process would require a supertest adapter incompatible with CLI's fetch-based API client.

### D4: Mock synthesis uploaded directly via `@azure/storage-blob`

The test uploads a synthetic file (`index.md`) to the Azurite container before the MCP test step, bypassing the synthesis worker entirely. This tests the read path (MCP → API → blob) without needing Container Apps.

### D5: MCP tested via subprocess stdio, not via SDK client

The MCP server communicates with newline-delimited JSON (`JSON.stringify(msg) + '\n'`). Test spawns `node mcp/dist/index.js` with env vars, writes JSON-RPC frames to stdin, reads from stdout. No MCP client library needed. Protocol version `2024-11-05` is in `SUPPORTED_PROTOCOL_VERSIONS`.

### D6: `--token` flag on `login` writes credentials directly

When `--token` is provided, `LoginCommand` skips the HTTP callback server entirely, writes `.fabrick/credentials.yaml` with the given token and `FABRICK_API_URL` env (or default), and exits. This is a pure shortcut — no change to the existing browser flow.

### D7: `--non-interactive` + `--org` + `--project` on `init`

In non-interactive mode, `init` resolves org by matching `--org` slug against the `/orgs` list, resolves or creates project by `--project` slug, calls `find-or-create` with `git remote get-url origin`, defaults AI tool to `claude`, and writes config without any readline. Fails fast with a clear error if org or slug is not found.

## Risks / Trade-offs

- **API startup race** → Mitigation: `npx wait-on http://localhost:3000/health` with retry before test runs
- **Port conflicts in GH Actions** → Port 3000 (API) and 10000 (Azurite blob) are not commonly occupied; low risk
- **Git remote missing in CI checkout** → The test must `git init && git remote add origin https://github.com/test/repo.git` in the temp dir before running `fabrick init`. The e2e test handles this in beforeAll.
- **`@azure/storage-blob` not in CLI devDeps** → Must be added for the integration test setup step (direct blob upload of mock synthesis). The API already has it; version must match.

## Open Questions

None — all decisions resolved during explore session.
