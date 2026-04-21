## 1. Create @fabrick/mcp package

- [x] 1.1 Create `applications/mcp/package.json` with name `@fabrick/mcp`, bin entry, deps: `@modelcontextprotocol/sdk`, `jsonwebtoken`, `@types/jsonwebtoken`
- [x] 1.2 Create `applications/mcp/tsconfig.json` (target ESNext, module NodeNext, outDir dist)
- [x] 1.3 Create `applications/mcp/src/api-client.ts` — thin fetch wrapper for `GET /orgs/:org/projects/:project/synthesis/file?path=:path`
- [x] 1.4 Create `applications/mcp/src/index.ts` — startup: read env, decode JWT, extract org/project, register tools, connect StdioServerTransport
- [x] 1.5 Add build script and verify `npx @fabrick/mcp` entry point resolves correctly

## 2. Tests

- [x] 2.1 Create `applications/mcp/src/index.test.ts` — unit tests for token decoding (valid JWT, missing claims, missing env vars)
- [x] 2.2 Create `applications/mcp/src/api-client.test.ts` — unit tests for API client (success response, non-200 throws, auth header forwarded)
- [x] 2.3 Add jest config to `applications/mcp/package.json` and verify tests pass

## 3. Update CLI

- [x] 3.1 In `applications/cli/src/init.command.ts`, remove `mcpUrl` computation (port+1 logic)
- [x] 3.2 Replace `.mcp.json` write with stdio format: `type: "stdio"`, `command: "npx"`, `args: ["-y", "@fabrick/mcp"]`, `env: { FABRICK_TOKEN, FABRICK_API_URL }`

## 4. Remove NestJS MCP server

- [x] 4.1 Remove `mcp` service from `applications/backend/docker-compose.yml`
- [x] 4.2 Delete `applications/backend/mcp/` directory entirely
