## Context

MCP server currently runs as a NestJS HTTP server (`applications/backend/mcp/`) on a separate port (API port + 1). It validates JWTs locally and proxies synthesis file reads to the API. Claude Code connects to it via `type: "http"` in `.mcp.json`.

The NestJS framework brings: container runtime, port management, docker-compose service, express dependency, reflect-metadata, rxjs. All of this for ~60 lines of actual logic.

## Goals / Non-Goals

**Goals:**
- Zero infrastructure to run MCP — user runs `npx @fabrick/mcp`, no server needed
- Same two tools (`get_synthesis_index`, `get_synthesis_file`) with identical behavior
- Token carries org/project claims — no separate config needed
- Tests for the new package

**Non-Goals:**
- Real-time / streaming synthesis (future websocket work)
- Caching synthesis files locally
- Multiple transport support in the npm package

## Decisions

### 1. StdioServerTransport instead of StreamableHTTPServerTransport

Stdio is the standard for local MCP tools (same as `mcp-filesystem`, `mcp-github`). Claude Code spawns the process, communicates over stdin/stdout. No port, no auth header on the transport layer — the token is passed via env var.

Alternatives considered:
- Keep HTTP, run locally: still requires port assignment, process management, startup latency
- SSE: same issues, more complex lifecycle

### 2. Token as env var `FABRICK_TOKEN`, API URL as `FABRICK_API_URL`

`fabrick init` writes these into `.mcp.json` under `env`. The package reads them at startup and decodes the JWT (no verify — the API validates on every request). Org and project extracted from `payload.org` / `payload.project`.

No verify needed because:
- Every API call sends the raw token as `Authorization: Bearer`
- API validates the JWT on each call
- Local decode is only to extract routing info (org/project)

Alternative: pass org/project as separate env vars alongside token. Rejected — adds redundancy, requires CLI to know the JWT contents for writing config. Better to decode once at startup.

### 3. No framework — plain TypeScript entry point

`src/index.ts` is the bin entry. ~80 lines total:
```
startup → decode token → create MCP Server → register tools → connect StdioTransport
```

No DI container, no decorators, no module system. Just functions.

### 4. Delete `applications/backend/mcp/`, not archive

The NestJS server has no unique logic not already captured in the new package. Keeping it creates confusion about which is canonical. If a future server-side MCP is needed, it will be built for websocket transport from scratch anyway.

### 5. `.mcp.json` format

```json
{
  "mcpServers": {
    "fabrick": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@fabrick/mcp"],
      "env": {
        "FABRICK_TOKEN": "<mcp-jwt>",
        "FABRICK_API_URL": "<api-url>"
      }
    }
  }
}
```

`-y` skips npx confirmation prompt. Token is the same JWT currently issued by `/auth/mcp-token`.

## Risks / Trade-offs

- **Cold start latency**: `npx` downloads the package on first run if not cached. Subsequent runs use cache. → Mitigation: document `npm install -g @fabrick/mcp` for faster startup
- **npx version**: without pinning, `latest` is always used. Breaking changes in the package would affect all users immediately. → Mitigation: semver discipline; major bumps only for breaking changes
- **Token in `.mcp.json`**: plaintext on disk, same as before. No change in security posture.

## Migration Plan

1. Implement `applications/mcp/` package
2. Update CLI to write new `.mcp.json` format
3. Delete `applications/backend/mcp/`
4. Remove MCP from `docker-compose.yml`
5. Users re-run `fabrick init` to get new `.mcp.json`

No server migration needed — the NestJS server is not publicly deployed yet.
