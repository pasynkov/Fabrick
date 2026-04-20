## Why

Fabrick has no user model — all operations are unauthenticated and unscoped. To support multi-tenant usage, CLI auth, and future per-org synthesis, we need a user/org/project/repo data layer with auth from the ground up.

## What Changes

- Add Postgres to docker-compose and wire TypeORM into NestJS
- Introduce entities: User, Organization, OrgMember, Project, Repository
- Email/password auth with JWT (web) and long-lived CLI tokens
- `fabrick login` flow: opens browser → user logs in → server generates CLI token → localhost callback → saved to `~/.fabrick/credentials.yaml`
- `fabrick init` checks token, creates/finds repo by git remote, stores `repo_id` in `.fabrick/config.yaml`
- **BREAKING** context upload endpoint moves to `/repos/:repoId/context` with auth guard
- **BREAKING** MinIO layout changes: `<org-slug>/` bucket → `<project-slug>/` prefix → `<repo-slug>/` prefix
- **BREAKING** single `fabrick` bucket removed; one bucket per org
- New Vite + React + Tailwind console SPA (console.fabrick.me)
- CLI rewritten in TypeScript using NestJS + nest-commander
- Admin can create org members (email + generated password, shown once)

## Capabilities

### New Capabilities

- `user-auth`: Email/password registration and login, JWT access tokens, long-lived CLI token generation and validation
- `org-management`: Organization CRUD, member management (admin creates users), role enforcement (admin/member)
- `project-repo-management`: Project and Repository CRUD within orgs; repo matched by normalized git remote
- `cli-auth-flow`: `fabrick login` opens browser, server generates CLI token, localhost callback, credentials stored locally
- `console-app`: SPA with login, register, CLI auth page, org/project/repo navigation, member management
- `cli-typescript`: Full CLI rewrite in TypeScript with nest-commander; `login`, `init`, `analyze`, `push` commands

### Modified Capabilities

- `context-upload`: Endpoint path changes to `/repos/:repoId/context`, auth guard added, MinIO path derived from repo's org/project/repo slugs
- `minio-bucket-init`: Single `fabrick` bucket replaced by per-org buckets created on org creation
- `fabrick-infra`: Postgres added to docker-compose; NestJS bootstraps TypeORM connection

## Impact

- `applications/backend/docker-compose.yml` — add Postgres service
- `applications/backend/api/` — TypeORM config, auth module, entities, guards, new endpoints
- `applications/cli/` — full rewrite to TypeScript + nest-commander
- `applications/console/` — new Vite + React + Tailwind app
- `.fabrick/config.yaml` — schema changes to `repo_id` + `api_url` only
- `~/.fabrick/credentials.yaml` — new file, CLI token storage
- MinIO objects in existing `fabrick` bucket — incompatible with new layout (local dev only, no migration needed)
