## Context

Three auth guards exist today:
- `JwtAuthGuard` — Passport JWT strategy, validates web session tokens (1h expiry)
- `CliTokenGuard` — sha256 hash lookup in `cli_tokens` table
- `AnyAuthGuard` — tries JWT first, falls through to CLI token DB lookup

Both `CliTokenGuard` and `AnyAuthGuard` hit the database on every request. MCP server has its own copy of the same DB-based validation.

## Goals / Non-Goals

**Goals:**
- Single guard for all token types
- No DB lookup for token validation (JWT.verify is local)
- `fbrk_` prefix on all CLI/MCP tokens for visual distinction
- MCP token embeds org/project/repo so headers are not needed
- Existing web JWT flow unchanged

**Non-Goals:**
- Token refresh mechanism
- Token revocation list (accept the trade-off for now)
- Multi-device CLI sessions

## Decisions

### 1. Token format

All Fabrick-issued long-lived tokens are JWTs signed with `JWT_SECRET`, prefixed with `fbrk_`:

```
fbrk_<base64url_header>.<base64url_payload>.<signature>
```

Payload shape:
```json
// CLI token (issued at fabrick login)
{ "sub": "user-id", "email": "user@example.com", "type": "cli", "iat": 0, "exp": 0 }

// MCP token (issued at fabrick init)
{ "sub": "user-id", "email": "user@example.com", "type": "mcp",
  "org": "org-slug", "project": "project-slug", "repo": "repo-id",
  "iat": 0, "exp": 0 }
```

Expiry: 1 year for both CLI and MCP tokens.

### 2. FabrickAuthGuard

```typescript
// Pseudocode
const raw = authHeader.slice(7); // strip "Bearer "
const token = raw.startsWith('fbrk_') ? raw.slice(5) : raw;
const payload = jwtService.verify(token);
request.user = { id: payload.sub, email: payload.email, type: payload.type,
                  org: payload.org, project: payload.project, repo: payload.repo };
```

No DB access. No fallback chain. Single verify call.

### 3. Endpoint changes

`POST /auth/cli-token`:
- Before: generates random hex, stores sha256 hash in DB, returns plaintext hex
- After: generates and returns `fbrk_<jwt>` with `type: "cli"`, no DB write

New `POST /auth/mcp-token`:
- Auth: requires valid JWT (web session or CLI token)
- Body: `{ orgSlug: string, projectSlug: string, repoId: string }`
- Returns: `{ token: "fbrk_<jwt>" }` with `type: "mcp"` + org/project/repo claims
- Called by CLI during `fabrick init`

### 4. Guard replacement

| Was | Replaced by |
|-----|-------------|
| `JwtAuthGuard` | `FabrickAuthGuard` (same behavior for web tokens) |
| `CliTokenGuard` | `FabrickAuthGuard` |
| `AnyAuthGuard` | `FabrickAuthGuard` |

### 5. cli_tokens table removal

Drop table via TypeORM migration. No data to preserve — users re-run `fabrick login` once.

## Risks / Trade-offs

- **No revocation**: a stolen `fbrk_` JWT is valid for 1 year. Mitigation: short-lived (1h) web sessions are unaffected. CLI/MCP tokens are long-lived by design. Accept for now; can add revocation list later if needed.
- **Migration**: existing CLI users have opaque tokens stored in `.fabrick/credentials.yaml`. They get a 401 on next CLI command and must re-run `fabrick login`. Acceptable — no silent data loss.
