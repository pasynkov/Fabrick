## Context

Fabrick currently has a NestJS API with no auth, no database, and a single `fabrick` MinIO bucket shared by all operations. The CLI is a plain JS Commander app. There is no concept of users, orgs, or isolation. This design introduces the full user/org/project/repo data layer, two auth mechanisms (web JWT + CLI long-lived token), a console SPA, and a TypeScript CLI rewrite — while keeping the local docker-compose workflow intact.

## Goals / Non-Goals

**Goals:**
- Postgres + TypeORM entity layer: User, Organization, OrgMember, Project, Repository
- Email/password auth with bcrypt, JWT access tokens for web
- Long-lived opaque CLI tokens stored in DB; issued via browser-based `fabrick login` flow
- Per-org MinIO bucket isolation; bucket created on org creation
- `/repos/:repoId/context` replaces `/context/:repo`; guarded by CLI token auth
- `fabrick init` verifies token, matches or creates repo by normalized git remote, writes `repo_id` to `.fabrick/config.yaml`
- Vite + React + Tailwind console SPA at `applications/console/`
- CLI rewrite: TypeScript + NestJS bootstrap + nest-commander

**Non-Goals:**
- Third-party OAuth (Google, GitHub)
- Email invitations
- Password reset / change password flow
- Audit logging
- API rate limiting
- Billing or usage limits
- Multiple CLI tokens per user (v1: one active token per user)
- Branches / environments for context versioning

## Decisions

### 1. TypeORM with decorators over Prisma

TypeORM integrates natively with NestJS DI and uses decorator-based entities that colocate schema with code. Prisma requires a separate schema file and a generation step. For a NestJS-first project, TypeORM reduces tooling surface.

### 2. Two token types: JWT (web) + opaque long-lived token (CLI)

Web sessions use short-lived JWTs (1h, no refresh token for now). CLI uses a single opaque SHA-256 token stored in `cli_tokens` table, tied to a user. JWTs aren't suitable for CLI because they expire and can't be revoked per-device. Opaque tokens can be deleted from DB to revoke.

### 3. CLI login flow: local HTTP callback server

```
CLI starts local HTTP server on random port
CLI opens browser: console.fabrick.me/cli-auth?port=PORT&state=UUID
User logs in on console
Console POSTs to API: /auth/cli-token {state}
API creates token, redirects to: http://localhost:PORT/callback?token=TOKEN
CLI receives token, closes server, writes ~/.fabrick/credentials.yaml
```

No OAuth required. State UUID prevents CSRF. Token is opaque, stored hashed in DB.

### 4. One MinIO bucket per org

Bucket name = org slug (validated: `^[a-z0-9-]{3,63}$`). Created when org is created. Object path: `<project-slug>/<repo-slug>/context/<filepath>`. This enables future per-project synthesis by listing a prefix.

Alternatives considered: single bucket with org prefix — rejected because it doesn't provide isolation and complicates future per-org access control.

### 5. git remote normalization

```
https://github.com/acme/backend.git  →  github.com/acme/backend
git@github.com:acme/backend.git      →  github.com/acme/backend
```

Stored as `git_remote` on Repository. Used as lookup key in `fabrick init`. Repo slug derived from last path segment.

### 6. `.fabrick/config.yaml` schema

```yaml
repo_id: <uuid>
api_url: https://api.fabrick.me
```

All other context (org, project, bucket path) resolved server-side from `repo_id`. CLI only needs these two fields.

### 7. CLI: NestJS application context + nest-commander

CLI commands run inside a NestJS application context (bootstrapped without HTTP server). This gives access to the full DI container (services, config) in CLI commands, consistent with the API codebase. nest-commander wraps Commander with NestJS-style command classes.

### 8. Console: standalone Vite app

`applications/console/` — separate from API. In local dev: `vite dev` on port 5173, API on 3000. CORS configured in NestJS to allow localhost:5173. In production: deployed as static files to CDN.

### 9. Admin creates members without invite

Admin provides email, console generates a random password, displays it once. User record created immediately. No email sending, no invite tokens. Acceptable for v1 internal/team usage.

## Risks / Trade-offs

- **Single CLI token per user** → If a user works from multiple machines, logging in from one revokes the other. Mitigation: document this; multi-token support is a clear v2 upgrade.
- **No password change flow** → Users are stuck with admin-generated passwords. Mitigation: acceptable for v1; add self-service password change in a follow-up.
- **Org slug = bucket name** → Renaming an org would require renaming a bucket (not trivial in MinIO). Mitigation: slugs are set on creation and not editable in v1.
- **Local callback server for CLI auth** → Firewall or port conflicts could block the callback. Mitigation: retry with different port; document requirement for localhost access.
- **Breaking MinIO layout** → Existing local context objects under old paths become orphaned. Mitigation: local dev only, no migration needed — developers re-run `fabrick push`.

## Open Questions

- Should JWT access tokens have refresh tokens in v1, or just require re-login after 1h? → Decision: no refresh, re-login. Web console sessions are short-lived dev tool sessions.
- Port range for CLI callback server? → Use `0` (OS assigns) and read the assigned port.
