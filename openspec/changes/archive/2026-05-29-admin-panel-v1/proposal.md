## Why

There is currently no way for the Fabrick platform owner to inspect the full set of users, organizations, projects, and search activity across all tenants. As traffic grows we need a minimal read-only surface to answer "who is using the platform and how" without writing ad-hoc SQL against production. A single platform-admin user, scoped to a new `/admin` UI and matching API namespace, gives us that visibility now and a foundation for future ops actions.

## What Changes

- Introduce a platform-level admin role distinct from organization-level `admin` membership: a new `users.is_platform_admin` boolean column with a backfill that promotes the earliest-created user.
- Add a new NestJS module `applications/backend/api/src/admin/` exposing read-only endpoints under `/admin/*` guarded by a new `PlatformAdminGuard`.
- Endpoints (all read-only, sort by `createdAt DESC` where lists are returned):
  - `GET /admin/users`, `GET /admin/orgs`, `GET /admin/orgs/:id`
  - `GET /admin/projects`, `GET /admin/projects/:id`, `GET /admin/projects/:id/usage`
  - `GET /admin/search-requests?limit&offset&orgId&projectId`
- Refactor `AnalyticsService.getUsageForProject` so the org-membership check moves out of the service into the existing console-facing controller; the admin controller calls the same service without the check.
- Add a new Vite+React app at `applications/admin/` with `base: '/admin/'`. Tabs: Users / Orgs / Projects / Searches. Drill-down user→orgs→projects. Plain lists, all entity fields visible, `limit`/`offset` pagination, two dropdown filters (org, project) on the Searches tab.
- Auth reuse: the existing console login flow is the entry point. When `isPlatformAdmin === true` on the authenticated user, the console redirects to `/admin`. No separate login form.
- Deploy variant X: admin build is merged into `applications/console/dist/admin/` so it ships under `console.fabrick.me/admin`. `console/public/staticwebapp.config.json` gains a route rewrite for `/admin/*`. CI builds admin in parallel; `cd-release.yml`'s `deploy-console` job builds both and uploads the merged output. Deployment verification checks both `health.json` files.
- Update `cd-implementation-pipeline` build-fixer to include the new `applications/admin/` build alongside existing app builds.
- DB schema additions: `ALTER TABLE users ADD COLUMN is_platform_admin boolean NOT NULL DEFAULT false`; idempotent backfill `UPDATE users SET is_platform_admin = true WHERE id = (SELECT id FROM users ORDER BY created_at ASC LIMIT 1) AND NOT EXISTS (SELECT 1 FROM users WHERE is_platform_admin = true)`; `CREATE INDEX search_requests_created_at_desc_idx ON search_requests (created_at DESC)` to support the global search-requests list.
- JWT pipeline: `JwtStrategy` populates `request.user.isPlatformAdmin` so guards and controllers can read it without an extra round trip.

## Capabilities

### New Capabilities
- `platform-admin-api`: Backend module, endpoints, guard, and analytics-service refactor that expose read-only platform data to a platform admin.
- `platform-admin-ui`: Standalone Vite+React app at `applications/admin/` with tabs, drill-down, pagination, and filters described above.
- `platform-admin-deployment`: Merged-build deploy under `console.fabrick.me/admin`, including `staticwebapp.config.json` routing, parallel CI build, and post-deploy health verification.

### Modified Capabilities
- `user-auth`: Adds `is_platform_admin` field to the user model and surfaces it on the authenticated principal (`request.user`). Login response / token contents may change so the console can decide to redirect to `/admin`.
- `multi-agent-implementation-pipeline`: build-fixer subagent must include `applications/admin/` in its build matrix.

## Impact

- **Backend**: New `admin/` NestJS module; refactor of `analytics.service.ts` and `analytics.controller.ts` to move membership enforcement; updated `jwt.strategy.ts`; new TypeORM migration.
- **Frontend**: New `applications/admin/` workspace (Vite+React, shared visual language with console where practical). Console gains a post-login redirect branch when `isPlatformAdmin`. `console/public/staticwebapp.config.json` updated.
- **CI/CD**: New parallel build job for admin in `ci-unit.yml` (or equivalent); `cd-release.yml` `deploy-console` builds and merges admin; `verify-deployment` includes `console.fabrick.me/admin/health.json`.
- **Skills**: `.claude/skills/cd-implementation-pipeline/` build-fixer updated to know about `applications/admin/`.
- **Data**: One additive column (`users.is_platform_admin`), one idempotent backfill, one new index on `search_requests(created_at DESC)`. No destructive migrations.
- **Out of scope for v1**: write actions, audit log, impersonation, billing, cross-cutting aggregates, date-range filter, additional sortable columns, persisted filter state, separate admin domain/SWA.
