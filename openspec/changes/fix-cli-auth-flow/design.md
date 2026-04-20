## Context

Fabrick CLI uses NestJS CommandFactory with nest-commander. Three bugs block local dev:
1. `login` leaves process alive after auth — HTTP callback server is closed but CommandFactory keeps the event loop open
2. `CredentialsService` hardcodes `~/.fabrick/credentials.yaml` — breaks per-project local dev with different API URLs
3. `fetch failed` on localhost — Node.js native fetch with HTTP (non-TLS) URLs can fail in some environments; also the URL stored in creds may mismatch what was passed

## Goals / Non-Goals

**Goals:**
- `login` exits cleanly with code 0 after saving credentials
- Credentials stored at `.fabrick/credentials.yaml` (project-local) by default
- Global fallback `~/.fabrick/credentials.yaml` still supported when no project-local creds exist
- Localhost HTTP URLs work in `init` and `push`

**Non-Goals:**
- OAuth flow changes
- Multi-profile / named credential support
- Windows path handling beyond what Node.js `path` already handles

## Decisions

### 1. `process.exit(0)` in LoginCommand.run()
Add explicit `process.exit(0)` at end of `run()`. Alternatively we could call `CommandFactory.close()`, but NestJS CLI apps typically use `process.exit` — it's simpler and matches the existing pattern in `requireAuth()` which calls `process.exit(1)`.

### 2. Project-local credentials with global fallback
`CredentialsService` changes:
- `write()` always writes to `.fabrick/credentials.yaml` (CWD-relative)
- `read()` checks `.fabrick/credentials.yaml` first, falls back to `~/.fabrick/credentials.yaml`
- `requireAuth()` unchanged — uses `read()` so fallback is automatic

This is safe because `login` is always run inside or near the project directory for local dev. For CI/CD without a project dir, global fallback still works.

**Alternative considered**: support `--global` flag — rejected as scope creep.

### 3. Fix "fetch failed" on localhost
Root cause: Node.js 18+ native `fetch` works with `http://` URLs, so this is likely a URL format issue — user may pass `http://localhost:3000` without trailing slash, or the stored `api_url` in credentials has extra whitespace or wrong format. Fix: trim and normalize the URL in `ApiService.request()` before concatenation. No special localhost handling needed.

## Risks / Trade-offs

- **Risk**: Users who already have `~/.fabrick/credentials.yaml` won't get auto-migrated. → Mitigation: fallback read still works, they re-login once.
- **Risk**: `process.exit(0)` skips NestJS shutdown hooks. → Acceptable — CLI commands don't use lifecycle hooks.

## Migration Plan

1. Deploy updated CLI build
2. Users re-run `fabrick login` once (writes to `.fabrick/credentials.yaml`)
3. Existing `~/.fabrick/credentials.yaml` continues to work as fallback
