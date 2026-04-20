## Context

Fabrick backend stores synthesis files in MinIO at `{orgSlug}/{projectSlug}/synthesis/`. The CLI token mechanism already provides long-lived auth for non-browser clients (hash stored in DB, raw token never stored). `fabrick init` already writes `.fabrick/config.yaml` and `.claude/` skills to the project.

Current `fabrick-search` reads a local `architecture/` folder — requires manual sync, gets stale.

## Goals / Non-Goals

**Goals:**
- MCP server that serves synthesis files over SSE, authenticated via CLI token
- `fabrick init` pre-configures `.mcp.json` so Claude Code picks up the server automatically
- `fabrick-search` skill becomes a thin prompt delegating all navigation to MCP tools
- E2E tests covering token auth → tool call → MinIO read

**Non-Goals:**
- MCP tools for writing/modifying synthesis (read-only)
- Multi-project MCP server (scoped per init to one org+project)
- OAuth / user-facing auth flows

## Decisions

### 1. Separate NestJS app (`applications/mcp/`)

**Decision:** New service, not routes in `applications/backend/api/`.

**Rationale:** MCP SSE requires a persistent HTTP connection per client; mixing with the REST API adds complexity. Separate service can be independently scaled and replaced. Shared DB access via same Postgres connection string.

**Alternative:** Add `/mcp` routes to existing backend. Rejected — SSE lifecycle conflicts with NestJS request scoping.

### 2. Transport: SSE (not stdio, not WebSocket)

**Decision:** HTTP + SSE, Claude Code MCP client connects via URL.

**Rationale:** MCP spec recommends SSE for remote servers. stdio is local-process only. WebSocket adds unnecessary complexity. NestJS `@Sse()` handles SSE natively.

**MCP endpoint:** `GET /sse?token={cliToken}&org={orgSlug}&project={projectSlug}`

### 3. Auth: CLI token in query param

**Decision:** Raw CLI token passed as `?token=xxx`, validated server-side via SHA-256 hash lookup (same as `CliTokenGuard` in backend).

**Rationale:** `.mcp.json` is a static file — no runtime auth headers possible. Query param is the only option for SSE URL-based auth. Token is long-lived by design.

**Risk:** Token visible in process list / logs. Mitigation: MCP server strips token from log output.

### 4. Org + project in URL params

**Decision:** `?org=myorg&project=myproject` baked into `.mcp.json` at `fabrick init` time.

**Rationale:** Token identifies the user but not the project. Baking org/project at init time means no tool-call overhead for discovery and Claude always queries the right project.

### 5. Two MCP tools only

**Decision:** `get_synthesis_index()` and `get_synthesis_file(path: string)`.

**Rationale:** Index is the navigation contract — Claude reads it first, then requests exactly what it needs. No `list_files` needed because index.md already maps questions to files. Minimal surface = minimal failure modes.

**Error behavior:**
- Synthesis not found → tool returns error string: `"Synthesis not available for project '{slug}'. Run synthesis first."`
- Invalid token → SSE connection rejected with 401 before tools are reachable

### 6. `.mcp.json` location

**Decision:** Project root `.mcp.json` (Claude Code auto-discovers).

**Rationale:** Claude Code reads `.mcp.json` at project root automatically. No manual config needed after `fabrick init`.

**Format:**
```json
{
  "mcpServers": {
    "fabrick": {
      "type": "sse",
      "url": "http://{API_URL}/mcp/sse?token={CLI_TOKEN}&org={ORG}&project={PROJECT}"
    }
  }
}
```

Note: `API_URL` base points to MCP service port (configurable, default 3001). Written by CLI at init time using values from `.fabrick/config.yaml` + freshly issued CLI token.

### 7. E2E tests

**Decision:** Jest E2E tests in `applications/mcp/test/` using real Postgres + MinIO (same pattern as backend).

**Coverage:**
- `GET /sse` with invalid token → 401
- `GET /sse` with valid token, project has no synthesis → tool returns error message
- `GET /sse` with valid token, synthesis exists → `get_synthesis_index` returns index.md content
- `GET /sse` with valid token, synthesis exists → `get_synthesis_file("cross-cutting/envs.md")` returns file content

## Risks / Trade-offs

- **SSE connection drops** → MCP client must reconnect. Claude Code handles reconnect. No mitigation needed in server.
- **Token in URL logged by reverse proxy** → Documented; operators should configure proxy to redact `token=` params.
- **Stale `.mcp.json` if token revoked** → `fabrick init` should re-issue token on re-run. Revoked token → 401, user re-runs `fabrick init`.
- **MCP SDK maturity** → `@modelcontextprotocol/sdk` is young. Pin to specific version.

## Open Questions

- MCP service port: hardcode 3001 or env var `MCP_PORT`? → Env var, default 3001.
- Should `fabrick init` re-issue CLI token on every run, or reuse existing? → Re-use if `.mcp.json` already exists and token still valid; re-issue otherwise.
