## REMOVED Requirements

### Requirement: SSE endpoint accepts CLI token auth
**Reason**: MCP server replaced by `@fabrick/mcp` npm package running as stdio process. No HTTP server exists to accept SSE connections.
**Migration**: Use `@fabrick/mcp` npm package via stdio transport. Run `fabrick init` to get updated `.mcp.json`.

### Requirement: get_synthesis_index tool returns index.md
**Reason**: Capability moved to `@fabrick/mcp` npm package (see `fabrick-mcp-npm` spec).
**Migration**: No migration needed — tool name and behavior identical in the npm package.

### Requirement: get_synthesis_file tool returns any synthesis file
**Reason**: Capability moved to `@fabrick/mcp` npm package (see `fabrick-mcp-npm` spec).
**Migration**: No migration needed — tool name and behavior identical in the npm package.

### Requirement: Token is not logged
**Reason**: No HTTP server — stdio transport has no access logs.
**Migration**: Not applicable.

## MODIFIED Requirements

### Requirement: MCP uses existing token for auth

MCP server SHALL use the existing `FABRICK_TOKEN` (MCP-scoped JWT with org/project claims) to authenticate against the search endpoint. No new token type needed. The `Server` constructor SHALL include an `instructions` field (via `ServerOptions`) containing a routing rule that references the project name extracted from the token.

#### Scenario: Token passed to search API
- **WHEN** `fabrick_search` is called
- **THEN** request to search API includes `Authorization: Bearer <token>` header with the MCP token

#### Scenario: Server instructions reference project name
- **GIVEN** token contains `project: "my-project"` claim
- **WHEN** MCP server starts
- **THEN** `Server` is constructed with `instructions` containing "my-project"
