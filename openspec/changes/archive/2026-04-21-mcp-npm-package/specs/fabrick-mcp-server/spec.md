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
