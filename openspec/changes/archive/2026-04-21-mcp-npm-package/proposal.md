## Why

The MCP server currently runs as a NestJS HTTP server requiring container infrastructure, a dedicated port, and its own deployment. For early-stage usage, a local npm package running as a stdio process eliminates all infrastructure overhead while delivering identical functionality.

## What Changes

- Delete `applications/backend/mcp/` (NestJS MCP server)
- Create `applications/mcp/` — `@fabrick/mcp` npm package, stdio transport, no framework
- Remove MCP service from `applications/backend/docker-compose.yml`
- Update `applications/cli/init.command.ts` — write stdio-based `.mcp.json` instead of HTTP
- Update `openspec/specs/fabrick-mcp-server/` spec to replace server requirements with npm package requirements
- Update `openspec/specs/fabrick-init-mcp/` spec to reflect stdio `.mcp.json` format

## Capabilities

### New Capabilities
- `fabrick-mcp-npm`: Standalone `@fabrick/mcp` npm package exposing Fabrick synthesis tools via MCP stdio transport

### Modified Capabilities
- `fabrick-mcp-server`: Requirements change from HTTP/SSE NestJS server to stdio npm package (token auth mechanism, transport, deployment model all change)
- `fabrick-init-mcp`: `.mcp.json` format changes from `type: "http"` to `type: "stdio"` with `npx @fabrick/mcp`

## Impact

- **Deleted**: `applications/backend/mcp/` (entire NestJS app)
- **New**: `applications/mcp/` (`@fabrick/mcp` package, ~100 lines, no framework deps)
- **Modified**: `applications/cli/src/init.command.ts` — remove port+1 MCP URL computation, write stdio config
- **Modified**: `applications/backend/docker-compose.yml` — remove `mcp` service
- **Dependencies removed**: NestJS, express, reflect-metadata, rxjs from MCP context
- **Dependencies kept**: `@modelcontextprotocol/sdk`, `jsonwebtoken`
