## ADDED Requirements

### Requirement: fabrick init writes .mcp.json
`fabrick init` SHALL write `.mcp.json` at the project root with the MCP server URL pre-configured using the org slug, project slug, and a CLI token.

#### Scenario: First-time init
- **WHEN** `fabrick init` completes successfully
- **THEN** `.mcp.json` exists at project root with `mcpServers.fabrick.url` containing token, org, and project

#### Scenario: Re-init reuses existing token
- **WHEN** `fabrick init` runs and `.mcp.json` already exists with a valid token
- **THEN** `.mcp.json` is overwritten with same token (no new token issued)

### Requirement: .mcp.json format is correct for Claude Code
The `.mcp.json` written by `fabrick init` SHALL use the format recognized by Claude Code for SSE MCP servers.

#### Scenario: Claude Code picks up server
- **WHEN** developer opens project in Claude Code after `fabrick init`
- **THEN** Claude Code shows `fabrick` MCP server as connected
