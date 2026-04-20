## 1. MCP app scaffold

- [x] 1.1 Create `applications/mcp/` — NestJS app with `package.json`, `tsconfig.json`, `nest-cli.json`, `src/main.ts`
- [x] 1.2 Add `@modelcontextprotocol/sdk`, `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `typeorm`, `@nestjs/typeorm`, `pg`, `minio` to `applications/mcp/package.json`
- [x] 1.3 Run `npm install` in `applications/mcp/`
- [x] 1.4 Create `applications/mcp/Dockerfile` (same pattern as backend: builder + runtime stage)

## 2. Shared infrastructure

- [x] 2.1 Copy `CliToken` entity and token validation logic into `applications/mcp/src/auth/` — validate raw token via SHA-256 hash lookup in Postgres
- [x] 2.2 Copy `MinioService` (with `getObject` + `listObjects`) into `applications/mcp/src/minio/`

## 3. MCP SSE server

- [x] 3.1 Create `applications/mcp/src/mcp/mcp.controller.ts` — `POST /mcp` endpoint (Streamable HTTP), reads `Authorization: Bearer` + `X-Fabrick-Org` + `X-Fabrick-Project` headers, rejects with 401 if token invalid
- [x] 3.2 Create `applications/mcp/src/mcp/mcp.service.ts` — initializes MCP `Server` from `@modelcontextprotocol/sdk`, registers `get_synthesis_index` and `get_synthesis_file` tools
- [x] 3.3 `get_synthesis_index`: reads `{projectSlug}/synthesis/index.md` from MinIO bucket `{orgSlug}`; returns content string or error message if not found
- [x] 3.4 `get_synthesis_file(path)`: reads `{projectSlug}/synthesis/{path}` from MinIO; returns content string or error message if not found
- [x] 3.5 Strip `token` param from request logs in `main.ts`
- [x] 3.6 Create `applications/mcp/src/mcp/mcp.module.ts` and `applications/mcp/src/app.module.ts`

## 4. Docker Compose

- [x] 4.1 Add `mcp` service to `applications/backend/docker-compose.yml` — build `./mcp`, port `3001:3001`, same DB + MinIO env vars as `api`

## 5. CLI: fabrick init writes .mcp.json

- [x] 5.1 In `applications/cli/src/init.command.ts`, after CLI token is obtained, write `.mcp.json` at `process.cwd()` with format:
  ```json
  { "mcpServers": { "fabrick": { "type": "sse", "url": "{apiUrl}/mcp/sse?token={token}&org={orgSlug}&project={projectSlug}" } } }
  ```
  where `apiUrl` replaces port 3000 with 3001 (or uses `MCP_URL` env if set)

## 6. fabrick-search skill

- [x] 6.1 Rewrite `.claude/skills/fabrick-search/SKILL.md` — thin prompt: start with `get_synthesis_index`, then call `get_synthesis_file` for relevant files, answer the question. Remove all local file reading instructions.

## 7. E2E tests

- [x] 7.1 Create `applications/mcp/test/mcp.e2e-spec.ts` with Jest — spin up real Postgres + MinIO (via env vars), seed: create org, project, CLI token, put `{project}/synthesis/index.md` and `{project}/synthesis/cross-cutting/envs.md` in MinIO
- [x] 7.2 Test: `POST /mcp` with invalid token → HTTP 401
- [x] 7.3 Test: valid token, no synthesis in MinIO → `get_synthesis_index` returns error string containing "not available"
- [x] 7.4 Test: valid token, synthesis exists → `get_synthesis_index` returns index.md content
- [x] 7.5 Test: valid token, synthesis exists → `get_synthesis_file("cross-cutting/envs.md")` returns file content
- [x] 7.6 Test: valid token → `get_synthesis_file("does-not-exist.md")` returns error string containing "not found"

## 8. Build and verify

- [x] 8.1 Rebuild Docker images: `docker compose build mcp api`
- [x] 8.2 Run E2E tests: `cd applications/mcp && npm test`
- [x] 8.3 Run `fabrick init` in a test project, verify `.mcp.json` is written
- [x] 8.4 Open project in Claude Code, verify `fabrick` MCP server shows as connected
- [x] 8.5 Ask a question via `fabrick-search` skill, verify MCP tools are called and answer is correct
