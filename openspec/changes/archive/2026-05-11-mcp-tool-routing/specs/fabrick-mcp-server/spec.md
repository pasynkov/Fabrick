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
