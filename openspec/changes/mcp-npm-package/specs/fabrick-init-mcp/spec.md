## MODIFIED Requirements

### Requirement: fabrick init writes .mcp.json
`fabrick init` SHALL write `.mcp.json` at the project root configured to run `@fabrick/mcp` as a stdio MCP server process with the MCP token and API URL passed as environment variables.

#### Scenario: First-time init
- **WHEN** `fabrick init` completes successfully
- **THEN** `.mcp.json` exists at project root with `mcpServers.fabrick.type = "stdio"`, `command = "npx"`, `args = ["-y", "@fabrick/mcp"]`, and `env` containing `FABRICK_TOKEN` and `FABRICK_API_URL`

#### Scenario: Re-init overwrites existing config
- **WHEN** `fabrick init` runs and `.mcp.json` already exists
- **THEN** `.mcp.json` is overwritten with current token and API URL

### Requirement: .mcp.json format is correct for Claude Code
The `.mcp.json` written by `fabrick init` SHALL use the stdio format recognized by Claude Code for local MCP server processes.

#### Scenario: Claude Code picks up server
- **WHEN** developer opens project in Claude Code after `fabrick init`
- **THEN** Claude Code shows `fabrick` MCP server as connected and tools are available
