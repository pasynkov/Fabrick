## MODIFIED Requirements

### Requirement: fabrick init writes .mcp.json
`fabrick init` SHALL write `.mcp.json` at the project root configured to run `@fabrick/mcp` as a stdio MCP server process with the MCP token and API URL passed as environment variables. The API URL written into `.mcp.json` MUST match the URL stored in `.fabrick/config.json` (`apiUrl`), which `fabrick init` prompts for with a default of `https://api.fabrick.me/`.

#### Scenario: First-time init
- **WHEN** `fabrick init` completes successfully
- **THEN** `.mcp.json` exists at project root with `mcpServers.fabrick.type = "stdio"`, `command = "npx"`, `args = ["-y", "@fabrick/mcp"]`, and `env` containing `FABRICK_TOKEN` and `FABRICK_API_URL`

#### Scenario: Re-init overwrites existing config
- **WHEN** `fabrick init` runs and `.mcp.json` already exists
- **THEN** `.mcp.json` is overwritten with current token and API URL

#### Scenario: API URL matches config
- **WHEN** `fabrick init` finishes
- **THEN** `mcpServers.fabrick.env.FABRICK_API_URL` equals `apiUrl` in `.fabrick/config.json`
