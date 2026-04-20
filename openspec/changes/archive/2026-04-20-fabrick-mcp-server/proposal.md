## Why

`fabrick-search` currently reads a locally downloaded `architecture/` folder. This requires the developer to manually pull synthesis files and keep them fresh. Moving synthesis access to a remote MCP server gives Claude live, on-demand access to any project's synthesis via two simple tools — no local files needed.

## What Changes

- New NestJS service (`applications/mcp/`) exposing an SSE-based MCP server
- MCP server exposes two tools: `get_synthesis_index` and `get_synthesis_file`
- Auth via CLI token passed as URL query param (`?token=xxx`)
- `fabrick init` writes `.mcp.json` to the project root, pre-configured with API URL + token + org + project
- `fabrick-search` skill is rewritten as a thin one-page prompt: "use MCP tools to navigate synthesis, start from index"
- E2E tests covering the full flow: token auth → tool call → MinIO read → response

## Capabilities

### New Capabilities

- `fabrick-mcp-server`: SSE MCP server that exposes synthesis navigation tools, authenticated via CLI token, org/project scoped via URL params
- `fabrick-init-mcp`: `fabrick init` writes `.mcp.json` to project root during setup

### Modified Capabilities

- `fabrick-search`: Skill rewritten to delegate all navigation to MCP tools instead of reading local files

## Impact

- New app: `applications/mcp/` (NestJS, separate Docker service)
- `applications/cli/src/init.command.ts` — writes `.mcp.json`
- `.claude/skills/fabrick-search/SKILL.md` — simplified prompt
- `docker-compose.yml` — new `mcp` service
- `package-lock.json` — new NestJS + MCP SDK dependencies
