## Context

Fabrick currently has two notions of "admin": the existing `OrgMember.role === 'admin'` (an organization owner) and… nothing for the platform itself. There is no UI or API to look across all tenants. The console at `console.fabrick.me` is a per-user SPA backed by `applications/backend/api` (NestJS + TypeORM + JWT). Search and usage data already exists as entities (`SearchRequest`, `TokenUsage`) with a per-project read-only endpoint guarded by org membership (`/v1/projects/:id/usage-analytics`).

The platform owner is currently one person (`npasynkov@gmail.com`). We do not need RBAC, audit, or write actions yet. We need a way to see "who's on the platform, what projects exist, and what people are searching for" without writing SQL against prod.

Constraints:
- Reuse existing JWT auth and TypeORM model — no new identity system.
- Reuse existing data — no new aggregated tables in v1.
- Host the new UI on the same Azure Static Web App as the console (`console.fabrick.me`) under `/admin`, so we do not provision new infra for a one-admin product.
- Keep the door open to extract the admin UI to its own domain/SWA later (`admin.fabrick.me`) without rewriting it.
- All proposal/spec/task artifacts and code commentary must be in English (project convention).

Stakeholders: solo platform owner today; the same person who reviews search-request quality and project health.

## Goals / Non-Goals

**Goals:**
- Read-only views over `User`, `Organization`, `Project`, and `SearchRequest` (with project usage aggregates) for a single platform admin.
- Single-source-of-truth for "admin" status that we can later extend to multiple admins or finer roles.
- Deploy path that is one merged static bundle today but trivially splittable into its own SWA later.
- Reuse the existing `AnalyticsService` so admin and console answers stay consistent.
- Parallelizable CI build so admin does not slow the existing release pipeline.

**Non-Goals:**
- Write actions (no banning users, no editing orgs, no rotating keys from /admin in v1).
- Audit log of admin reads (we accept that v1 admin actions are not logged).
- Impersonation / "view as user" — deferred.
- Billing surfaces — there is no billing yet.
- Date-range pickers, multi-column sort, persisted filter state, custom admin login form.
- A separate Azure resource / domain for admin (X variant explicitly chosen over Y).
- RBAC; the column is a single boolean flag, not a role table.

## Decisions

### 1. Identity: `users.is_platform_admin` boolean (not env-based, not role table)

Adopted: a single `boolean NOT NULL DEFAULT false` column on `users`, populated by an idempotent backfill that sets the earliest-created user to `true` only if no platform admin exists yet.

Alternatives considered:
- `PLATFORM_ADMIN_EMAIL` env var — rejected: ties admin identity to deploy config, breaks if email changes, harder to extend to >1 admin.
- New `platform_roles` table — rejected as premature: we have one admin; a boolean flag converts cleanly to a join table later if needed.
- "First user by `created_at`" computed live each request — rejected: brittle if the seed user is deleted, racy in tests, requires an extra query on every admin call.

Rationale: a boolean column is the cheapest schema change that survives email rotation, multiple admins, and seed-data churn. Backfill is idempotent: a `WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_platform_admin)` clause means re-running the migration in dev/test is safe.

### 2. Guard: `PlatformAdminGuard` reading `request.user.isPlatformAdmin`

Adopted: a new `PlatformAdminGuard` that throws `ForbiddenException` if `request.user.isPlatformAdmin !== true`. `JwtStrategy` will include `isPlatformAdmin` on the validated user object so the guard does not need to hit the DB.

Alternatives considered:
- Put the flag in JWT claims at login time — rejected for v1: invalidating an admin demotion would then require token revocation. Reading from `request.user` (which is hydrated on each request from the DB via the strategy) keeps demotion immediate.
- Extend `IsAdminGuard` (which checks org-level admin) — rejected: different concept (`OrgMember.role === 'admin'` vs platform-wide), conflating them would muddle the model.

### 3. Service refactor: move org-membership check out of `AnalyticsService`

`AnalyticsService.getUsageForProject(projectId, userId)` currently performs the membership check inline. We will refactor it to `getUsageForProject(projectId)` (no userId), with the existing console-facing controller doing the membership check before calling the service. The new admin controller calls the same service without that check.

Alternatives considered:
- `skipMembershipCheck: true` flag — rejected: dirty, leaks auth concerns into the service.
- Duplicate service for admin — rejected: divergence risk, more code to maintain.

This decision keeps the service pure (data fetching only) and pushes auth to its proper layer (controller/guard).

### 4. Frontend split: new `applications/admin/` workspace, merged build under `/admin`

Adopted: a new Vite+React app `applications/admin/` with `base: '/admin/'`. During release, both `console` and `admin` are built; admin's `dist/` is copied into `console/dist/admin/` and the merged tree is uploaded to the existing Azure Static Web App. `console/public/staticwebapp.config.json` gains:

```json
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/admin/*", "/assets/*"]
  },
  "routes": [
    { "route": "/admin",   "rewrite": "/admin/index.html" },
    { "route": "/admin/*", "rewrite": "/admin/index.html" }
  ]
}
```

Alternatives considered:
- Routes inside the existing console SPA — rejected: any bundle bug could leak admin UI elements to regular users, and the admin app cannot be deployed independently later.
- Separate Azure SWA (`admin.fabrick.me`, variant Y) — rejected for v1: extra DNS, extra resource, no real upside for a one-admin product. Variant X keeps the admin code already physically separate so a future move to Y is mechanical.

### 5. Auth flow: console-driven login + redirect

The console login flow is the only login. Post-auth, the console reads `me.isPlatformAdmin` and, if true, redirects to `/admin` (preserving any `?return_to` query parameter). The admin SPA also fetches the same `/me` endpoint on boot and gates all routes on `isPlatformAdmin === true`; a non-admin landing on `/admin/*` is bounced back to `/`.

Alternatives considered:
- A separate admin login page — rejected as unnecessary noise for one user.
- Server-side route guard via the SWA — rejected: SWA-level auth would couple us to Azure-specific identity.

### 6. Pagination & filtering

Endpoints accept `limit` (default 50, max 500) and `offset` (default 0). The Searches endpoint also accepts `orgId` and `projectId` as exact-match filters. Sort is fixed `created_at DESC`. Total counts are returned (`{ items, total }`) so the UI can show "showing 50 of 1342".

Alternatives considered:
- Keyset pagination — rejected for v1: limit/offset is simpler and admin volumes are small.
- Date-range filter, free-text search — deferred.

### 7. Index strategy

`search_requests` already has `idx_search_requests_project_created (project_id, created_at)`. The new global list ordered by `created_at DESC` (no projectId predicate) is not served efficiently by that index. We add `CREATE INDEX search_requests_created_at_desc_idx ON search_requests (created_at DESC)`.

For `users`, `organizations`, `projects` we accept full-table scans in v1 (low cardinality; the platform has at most O(10³) rows of each in the near term).

### 8. CI/CD: parallel admin build, merged release

- `ci-unit.yml` gains a `build-admin` job that runs alongside existing build/test jobs.
- `cd-release.yml`'s `deploy-console` job:
  1. Builds console (existing step).
  2. Builds admin (new step) in parallel where possible (or sequential within the same job if simpler).
  3. Copies `applications/admin/dist/*` into `applications/console/dist/admin/`.
  4. Uploads the merged `applications/console/dist` via the existing `Azure/static-web-apps-deploy@v1` action.
- `verify-deployment` adds a check for `https://console.fabrick.me/admin/health.json` with a version matching `applications/admin/package.json`.

### 9. Skill update: `cd-implementation-pipeline` build-fixer

The build-fixer subagent in `.claude/skills/cd-implementation-pipeline/` currently runs builds across a known list of apps. We add `applications/admin/` to that list so future implementation PRs that touch the admin app get a parallel build check.

## Risks / Trade-offs

- **Risk: Backfill on a fresh DB picks an unintended "first" user (e.g., a seed bot).** → Mitigation: in seeded environments the first user is the project owner; in tests we already control fixture order. The migration is idempotent — if a platform admin already exists, the backfill is a no-op — so a follow-up `UPDATE` can manually correct an unintended pick.
- **Risk: `request.user.isPlatformAdmin` becomes stale if we cache the user object somewhere.** → Mitigation: `JwtStrategy.validate` re-reads the user from the DB on every request (current behaviour). We will not add caching here.
- **Risk: SWA route config wrong → console assets served under `/admin/assets/*` 404.** → Mitigation: admin Vite `base: '/admin/'` so admin's own asset URLs are prefixed; the `exclude` clause on `navigationFallback` prevents SPA fallback from eating static asset paths. We verify both `/health.json` and `/admin/health.json` post-deploy.
- **Risk: Merged-build deploy ties admin release cadence to console.** → Mitigation: variant X is reversible; we can split to variant Y (`admin.fabrick.me`) without touching admin source code (`base: '/admin/'` becomes `base: '/'`, that's it).
- **Trade-off: limit/offset over keyset.** Accepted: small admin volumes, simpler UI. Will revisit if admin lists routinely exceed 10k rows.
- **Trade-off: No audit log.** Accepted explicitly; admin is one trusted user in v1.
- **Trade-off: Admin sees self in user list without badge.** Accepted; the admin knows who they are.

## Migration Plan

1. Add and ship the `users.is_platform_admin` column migration (additive, default `false`) ahead of any code that reads it. This is a no-op for production.
2. Ship the backfill migration in the same release (idempotent — no-op if any admin already exists).
3. Ship the `search_requests` index migration (`CONCURRENTLY` if Postgres allows in our migration framework; otherwise during a low-traffic window — search_requests is read-heavy, write-moderate).
4. Deploy backend with the new `admin/` module, refactored `AnalyticsService`, and updated `JwtStrategy`. Existing console endpoints continue to work; the controller-level membership check is unchanged in behavior.
5. Deploy console + merged admin bundle. Once `/admin/health.json` is reachable and returns the expected version, the rollout is done.
6. Manually verify in prod that `npasynkov@gmail.com` is the user flagged, and that login → console → redirect to `/admin` works end-to-end.

**Rollback:**
- Revert the deploy (Azure SWA + container app) to the previous release. The migration is additive and safe to leave in place. If we ever need to undo the schema change, a follow-up migration drops the column; nothing else depends on it once the admin feature is removed.

## Open Questions

- Do we want `isPlatformAdmin` to also appear in the `/me` response body the console already calls, or as a separate `/me/admin` endpoint? (Inclining toward `/me` to avoid an extra round trip.)
- Where exactly does `staticwebapp.config.json` live — keep it in `console/public/` and let Vite copy it as-is into `dist/`, or generate it at build time so admin builds can append routes? (Inclining toward keeping it static in `console/public/` for v1.)
- Naming of the admin app's package: `@fabrick/admin` vs `admin` (current console uses bare name `console`). Matching console keeps things consistent.
