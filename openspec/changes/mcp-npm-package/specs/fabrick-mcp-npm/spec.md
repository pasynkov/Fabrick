## ADDED Requirements

### Requirement: Package runs as stdio MCP server
`@fabrick/mcp` SHALL start an MCP server using StdioServerTransport when executed via `npx @fabrick/mcp` or as a bin entry.

#### Scenario: Successful startup with valid env
- **WHEN** package is executed with `FABRICK_TOKEN` and `FABRICK_API_URL` set
- **THEN** MCP server starts, StdioServerTransport connects, process waits for MCP messages on stdin

#### Scenario: Missing token exits with error
- **WHEN** package is executed without `FABRICK_TOKEN` env var
- **THEN** process exits with code 1 and prints error message to stderr

#### Scenario: Missing API URL exits with error
- **WHEN** package is executed without `FABRICK_API_URL` env var
- **THEN** process exits with code 1 and prints error message to stderr

### Requirement: Token decoded to extract org and project
The package SHALL decode `FABRICK_TOKEN` (JWT, with optional `fbrk_` prefix stripped) at startup to extract `org` and `project` claims. Token is NOT verified locally — the API validates on each request.

#### Scenario: Valid JWT with org and project claims
- **WHEN** `FABRICK_TOKEN=fbrk_<jwt>` where JWT payload contains `{ org: "myorg", project: "myproject" }`
- **THEN** package uses `myorg` and `myproject` for all API calls

#### Scenario: JWT missing org or project claim
- **WHEN** decoded token payload lacks `org` or `project`
- **THEN** process exits with code 1 and prints error indicating missing claims

### Requirement: get_synthesis_index tool returns index.md content
The MCP server SHALL expose a `get_synthesis_index` tool that fetches `index.md` from the Fabrick API synthesis endpoint and returns its text content.

#### Scenario: Synthesis exists
- **WHEN** `get_synthesis_index` is called and API returns 200 with content
- **THEN** tool returns `{ content: [{ type: "text", text: "<file content>" }] }`

#### Scenario: Synthesis not available
- **WHEN** `get_synthesis_index` is called and API returns non-200
- **THEN** tool returns `{ content: [{ type: "text", text: "Synthesis not available for project '<project>'. Run synthesis first." }] }`

### Requirement: get_synthesis_file tool returns any synthesis file
The MCP server SHALL expose a `get_synthesis_file(path: string)` tool that fetches the specified path from the API synthesis endpoint.

#### Scenario: File exists
- **WHEN** `get_synthesis_file` is called with a valid path and API returns 200
- **THEN** tool returns `{ content: [{ type: "text", text: "<file content>" }] }`

#### Scenario: File not found
- **WHEN** `get_synthesis_file` is called with a path not found in synthesis
- **THEN** tool returns `{ content: [{ type: "text", text: "File '<path>' not found in synthesis for project '<project>'." }] }`

#### Scenario: Missing path argument
- **WHEN** `get_synthesis_file` is called without a `path` argument
- **THEN** tool returns `{ content: [{ type: "text", text: "Error: path argument is required" }] }`

### Requirement: API calls forward token as Authorization header
All HTTP calls to `FABRICK_API_URL` SHALL include the original `FABRICK_TOKEN` value as `Authorization: Bearer <token>`.

#### Scenario: API call includes correct auth header
- **WHEN** any MCP tool triggers an API call
- **THEN** request includes `Authorization: Bearer fbrk_<jwt>`
