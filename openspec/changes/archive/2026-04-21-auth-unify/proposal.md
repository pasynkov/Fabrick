## Why

Auth is fragmented across three guards (`JwtAuthGuard`, `CliTokenGuard`, `AnyAuthGuard`) and two token formats (JWT for web, opaque hex for CLI). `AnyAuthGuard` falls through from JWT to a DB lookup on every CLI request. The MCP server duplicates token validation with its own DB connection.

Moving to unified JWT tokens eliminates the DB lookup path for token validation, enables MCP to validate tokens locally without calling the API or the database, and reduces guard logic to a single implementation.

## What Changes

- `POST /auth/cli-token` returns a `fbrk_`-prefixed JWT instead of a random hex string
- New `POST /auth/mcp-token` endpoint: called by CLI at `fabrick init`, returns `fbrk_` JWT with org/project/repo embedded in claims
- New `FabrickAuthGuard` replaces `CliTokenGuard` and `AnyAuthGuard`: strips `fbrk_` prefix, verifies JWT signature locally
- `cli_tokens` table and `CliToken` entity removed
- CLI stores and sends `fbrk_` JWT as Bearer token
- `fabrick init` calls `/auth/mcp-token` and writes the resulting token into `.mcp.json`

## Token Format

```
Web session:  eyJ...            { sub, email, type: "web", exp: 1h }
CLI token:    fbrk_eyJ...       { sub, email, type: "cli", exp: 1yr }
MCP token:    fbrk_eyJ...       { sub, email, type: "mcp", org, project, repo, exp: 1yr }
```

All tokens signed with the same `JWT_SECRET`. `FabrickAuthGuard` validates all three; individual guards can assert `type` when needed.

## Capabilities

No new user-facing capabilities. Internal refactor only.

## Impact

- Removes: `cli_tokens` DB table, `CliToken` entity, `CliTokenGuard`, `AnyAuthGuard`
- Adds: `FabrickAuthGuard`, `POST /auth/mcp-token`
- Changes: `POST /auth/cli-token` response format, CLI credentials storage
- Prerequisite for: `mcp-decouple` (MCP validates JWT locally, no DB needed)
