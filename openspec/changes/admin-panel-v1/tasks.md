## 1. Database & Entity

- [x] 1.1 Add TypeORM migration adding `is_platform_admin boolean NOT NULL DEFAULT false` to `users`
- [x] 1.2 Add TypeORM migration with idempotent backfill: set `is_platform_admin = true` for the user with the smallest `created_at` only when no row already has `is_platform_admin = true`
- [x] 1.3 Add TypeORM migration `CREATE INDEX search_requests_created_at_desc_idx ON search_requests (created_at DESC)`
- [x] 1.4 Add `isPlatformAdmin: boolean` to `User` entity, defaulting to `false`

## 2. Auth Wiring

- [x] 2.1 Update `JwtStrategy.validate` to attach `isPlatformAdmin` (live DB value) onto the user returned from `validate`
- [x] 2.2 Include `isPlatformAdmin` in the `/auth/login` and `/auth/register` response `user` object
- [x] 2.3 Include `isPlatformAdmin` in the `/me` response (or equivalent) consumed by the console
- [x] 2.4 Create `applications/backend/api/src/admin/platform-admin.guard.ts` returning `true` only when `request.user.isPlatformAdmin === true`, otherwise throwing `ForbiddenException`
- [x] 2.5 Add unit tests for `PlatformAdminGuard` covering admin allowed, non-admin rejected, unauthenticated rejected

## 3. Analytics Service Refactor

- [x] 3.1 Change `AnalyticsService.getUsageForProject` signature to `(projectId: string)` and remove the membership lookup from inside the service
- [x] 3.2 Move the org-membership check into `AnalyticsController.getUsage` so it runs before invoking the service
- [x] 3.3 Update existing analytics tests to cover the controller-level enforcement (member allowed, non-member 404)
- [x] 3.4 Ensure existing `GET /v1/projects/:id/usage-analytics` behavior is unchanged from the client's perspective

## 4. Admin Module & Endpoints

- [x] 4.1 Create `applications/backend/api/src/admin/admin.module.ts` registering all admin controllers and the guard
- [x] 4.2 Wire `AdminModule` into `app.module.ts`
- [x] 4.3 Implement `AdminUsersController` with `GET /admin/users?limit&offset` returning `{ items, total, limit, offset }` sorted by `created_at DESC`, clamping `limit` to `[1, 500]`, default `limit=50, offset=0`
- [x] 4.4 Implement `AdminOrgsController.list` (`GET /admin/orgs?limit&offset`) and `AdminOrgsController.detail` (`GET /admin/orgs/:id`) returning members and projects; 404 when missing
- [x] 4.5 Implement `AdminProjectsController.list` (`GET /admin/projects?limit&offset`) including parent `orgId, orgName` per item
- [x] 4.6 Implement `AdminProjectsController.detail` (`GET /admin/projects/:id`) returning project metadata, parent org, repositories; 404 when missing
- [x] 4.7 Implement `AdminProjectsController.usage` (`GET /admin/projects/:id/usage`) delegating to `AnalyticsService.getUsageForProject(id)` without a membership check
- [x] 4.8 Implement `AdminSearchController.list` (`GET /admin/search-requests?limit&offset&orgId&projectId`) returning `{ items, total, limit, offset }` sorted by `created_at DESC`, with each item carrying `projectName` and `orgName`
- [x] 4.9 Apply `JwtAuthGuard` and `PlatformAdminGuard` (in that order) to every admin controller
- [x] 4.10 Add e2e tests covering: non-admin gets 403, admin gets data, pagination clamping, org/project filters on `/admin/search-requests`, missing-id 404s on detail endpoints

## 5. Admin Frontend Scaffold

- [x] 5.1 Create `applications/admin/` with `package.json` (matching the console's React/Vite/Tailwind versions where reasonable)
- [x] 5.2 Create `applications/admin/vite.config.ts` configuring `base: '/admin/'`, the React plugin, Tailwind, and a `health-json` plugin emitting `dist/health.json` with `{ version }` from `package.json`
- [x] 5.3 Set up `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `index.html`, `src/main.tsx`, `src/App.tsx` mirroring the console scaffold style
- [x] 5.4 Add a shared API client (`src/api.ts`) and JWT/refresh handling (`src/auth.tsx`, `src/tokenRefresh.ts`) reusing the same storage keys as the console
- [x] 5.5 Implement a root-level admin guard that fetches `/me`, allows the route when `isPlatformAdmin === true`, and otherwise redirects to `/` (or the console login route with `?return_to=`)
- [x] 5.6 Implement the top-of-page tab bar with four tabs: Users, Orgs, Projects, Searches; default `/admin` → `/admin/users`

## 6. Admin Frontend Lists & Drill-Downs

- [x] 6.1 Build the Users list view backed by `GET /admin/users` with all fields, limit/offset URL params, prev/next controls, "showing N–M of T" label
- [x] 6.2 Build the user-detail view (`/admin/users/:id`) listing the user's organizations with click-through to org detail
- [x] 6.3 Build the Orgs list view backed by `GET /admin/orgs` with all fields, pagination, click-through
- [x] 6.4 Build the org-detail view (`/admin/orgs/:id`) showing the org's members and projects with click-through to project detail
- [x] 6.5 Build the Projects list view backed by `GET /admin/projects` with all fields, parent org column, pagination, click-through
- [x] 6.6 Build the project-detail view (`/admin/projects/:id`) showing project metadata, repositories, and the project's search-requests + token-usage tables (via `/admin/projects/:id/usage`)
- [x] 6.7 Build the Searches list view (`/admin/searches`) with all search-request fields plus `projectName` and `orgName`, pagination, two dropdown filters (org, project) reflected in URL query params

## 7. Console Redirect & Static Web App Config

- [ ] 7.1 In the console, after login (and on any console-route load) read `me.isPlatformAdmin`; if true redirect to `/admin`, honoring an optional `?return_to=` query param
- [ ] 7.2 Update `applications/console/public/staticwebapp.config.json` to add `routes` for `/admin` and `/admin/*` rewriting to `/admin/index.html` and `navigationFallback.exclude` for `/admin/*` and `/assets/*`
- [ ] 7.3 Verify locally that a manual merge (copying `applications/admin/dist/*` into `applications/console/dist/admin/`) produces a working SPA at `/admin` when served by a static server with the SWA config applied

## 8. CI & Release Pipeline

- [ ] 8.1 Add a `build-admin` job to `.github/workflows/ci-unit.yml` (or its successor) running `npm ci --legacy-peer-deps && npm run build` in `applications/admin/` on Node 24, scheduled in parallel with other frontend build jobs
- [ ] 8.2 Update `cd-release.yml` `deploy-console` job to also `npm ci && npm run build` in `applications/admin/`, then copy `applications/admin/dist/*` into `applications/console/dist/admin/` before invoking `Azure/static-web-apps-deploy@v1`
- [ ] 8.3 Update the version-bump step in `cd-release.yml` to include `applications/admin/package.json` in the list of files whose `version` is rewritten on release
- [ ] 8.4 Update the `verify-deployment` step to additionally fetch `https://console.fabrick.me/admin/health.json` and assert its `version` equals the release version (using the same `check_version` helper as the existing console check)

## 9. Skill Updates

- [ ] 9.1 Update `.claude/skills/cd-implementation-pipeline/SKILL.md` (or its referenced step-4 instructions) so the orchestrator dispatches seven parallel build calls including `applications/admin/`
- [ ] 9.2 Update `.claude/agents/build-fixer.md` (or equivalent) if it enumerates the buildable apps, to add `applications/admin/`

## 10. Verification

- [ ] 10.1 Run `cd applications/backend/api && npm run test:unit` — all unit tests green
- [ ] 10.2 Run `cd applications/backend/api && npm run test:e2e` — all e2e tests green
- [ ] 10.3 Run `cd applications/admin && npm run build` — admin build green
- [ ] 10.4 Run `cd applications/console && npm run build` — console build green (no regression from SWA config change)
- [ ] 10.5 Manual smoke: log into console as the seeded admin, observe redirect to `/admin`, visit all four tabs, drill-down user → org → project, verify Searches dropdown filters change the API call
- [ ] 10.6 Manual smoke: log into console as a non-admin user, confirm no `/admin` redirect and that direct `/admin` URL bounces back
