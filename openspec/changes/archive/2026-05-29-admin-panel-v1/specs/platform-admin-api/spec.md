## ADDED Requirements

### Requirement: Platform admin role on the user model
The system SHALL persist platform-admin status as a single `is_platform_admin boolean NOT NULL DEFAULT false` column on the `users` table. There SHALL be exactly one source of truth for this flag (the column); the flag SHALL NOT be conflated with `OrgMember.role = 'admin'`, which remains the organization-level role.

#### Scenario: Column exists with safe default
- **WHEN** the migration adding `is_platform_admin` has been applied
- **THEN** every existing and newly inserted user row SHALL have `is_platform_admin = false` unless explicitly updated

#### Scenario: Idempotent backfill of the first platform admin
- **WHEN** the backfill migration runs against a database that has at least one user and no user with `is_platform_admin = true`
- **THEN** the migration SHALL set `is_platform_admin = true` for the user with the smallest `created_at` (ties broken by smallest `id`)
- **AND** re-running the migration SHALL be a no-op (the `WHERE NOT EXISTS (SELECT 1 FROM users WHERE is_platform_admin = true)` clause prevents reassignment)

#### Scenario: Org admin does not imply platform admin
- **WHEN** a user has `OrgMember.role = 'admin'` for one or more organizations but `users.is_platform_admin = false`
- **THEN** the system SHALL treat the user as a non-platform-admin for any `/admin/*` endpoint

### Requirement: JWT strategy exposes platform-admin flag on the request user
The `JwtStrategy.validate` SHALL include `isPlatformAdmin` on the user object it attaches to `request.user`. The flag SHALL reflect the current database value at the time of the request, not the value at token issuance.

#### Scenario: Authenticated request carries the flag
- **WHEN** a request with a valid JWT reaches a controller
- **THEN** `request.user.isPlatformAdmin` SHALL equal the current `users.is_platform_admin` value for that user

#### Scenario: Demoted admin loses access immediately
- **WHEN** a user with a still-valid JWT had their `is_platform_admin` flipped from `true` to `false` between requests
- **THEN** their next request to any `/admin/*` endpoint SHALL be rejected with HTTP 403

### Requirement: PlatformAdminGuard restricts /admin endpoints
The system SHALL provide a `PlatformAdminGuard` that authorizes a request only when `request.user.isPlatformAdmin === true`. Every controller under the new `admin/` module SHALL apply `JwtAuthGuard` followed by `PlatformAdminGuard`.

#### Scenario: Platform admin allowed
- **WHEN** a user with `is_platform_admin = true` requests any `/admin/*` endpoint with a valid JWT
- **THEN** the guard SHALL allow the request to proceed

#### Scenario: Authenticated non-admin rejected
- **WHEN** a user with `is_platform_admin = false` requests any `/admin/*` endpoint with a valid JWT
- **THEN** the system SHALL return HTTP 403

#### Scenario: Unauthenticated request rejected
- **WHEN** an `/admin/*` endpoint receives a request without a valid JWT
- **THEN** the system SHALL return HTTP 401 (from `JwtAuthGuard`) without consulting `PlatformAdminGuard`

### Requirement: GET /admin/users lists every user
The system SHALL expose `GET /admin/users?limit&offset` returning every user row in `users` ordered by `created_at DESC`, including the requesting admin without any distinguishing field. The response SHALL include all entity fields the existing console-side User DTO already exposes plus `isPlatformAdmin`. The response envelope SHALL be `{ items, total, limit, offset }`.

#### Scenario: Returns paginated users with total
- **WHEN** an admin requests `GET /admin/users?limit=50&offset=0`
- **THEN** the response SHALL contain at most 50 user objects ordered by `created_at DESC`
- **AND** the response SHALL contain a `total` field equal to the full count of `users`

#### Scenario: Default pagination
- **WHEN** an admin requests `GET /admin/users` without `limit` or `offset`
- **THEN** the system SHALL default `limit` to 50 and `offset` to 0

#### Scenario: Pagination bounds
- **WHEN** an admin requests `GET /admin/users?limit=10000`
- **THEN** the system SHALL clamp `limit` to a maximum of 500

### Requirement: GET /admin/orgs lists every organization
The system SHALL expose `GET /admin/orgs?limit&offset` returning every row in `organizations` ordered by `created_at DESC`. The response envelope SHALL be `{ items, total, limit, offset }`.

#### Scenario: Returns paginated orgs
- **WHEN** an admin requests `GET /admin/orgs`
- **THEN** the response SHALL contain the requested page of organizations ordered by `created_at DESC` plus a `total` count

### Requirement: GET /admin/orgs/:id returns org detail with members and projects
The system SHALL expose `GET /admin/orgs/:id` returning the organization object plus its members (joined from `org_members` with each member's user `id`, `email`, `role`) and its projects (id, name, createdAt). The system SHALL return HTTP 404 when no such organization exists.

#### Scenario: Existing org returned with relations
- **WHEN** an admin requests `GET /admin/orgs/:id` for a real org
- **THEN** the response SHALL include the org fields, the list of members (with user email and role), and the list of projects

#### Scenario: Missing org returns 404
- **WHEN** an admin requests `GET /admin/orgs/:id` with a non-existent id
- **THEN** the system SHALL return HTTP 404

### Requirement: GET /admin/projects lists every project
The system SHALL expose `GET /admin/projects?limit&offset` returning every row in `projects` joined with the parent organization, ordered by `created_at DESC`. Each item SHALL include the project fields plus `{ orgId, orgName }`. The response envelope SHALL be `{ items, total, limit, offset }`.

#### Scenario: Returns paginated projects with org reference
- **WHEN** an admin requests `GET /admin/projects`
- **THEN** the response items SHALL each carry their parent org's id and name

### Requirement: GET /admin/projects/:id returns project detail
The system SHALL expose `GET /admin/projects/:id` returning the project entity, its parent org (id, name), and its repository list. The system SHALL return HTTP 404 when no such project exists.

#### Scenario: Existing project returned with relations
- **WHEN** an admin requests `GET /admin/projects/:id`
- **THEN** the response SHALL include the project fields, the parent org, and the list of repositories

#### Scenario: Missing project returns 404
- **WHEN** an admin requests `GET /admin/projects/:id` with a non-existent id
- **THEN** the system SHALL return HTTP 404

### Requirement: GET /admin/projects/:id/usage reuses AnalyticsService
The system SHALL expose `GET /admin/projects/:id/usage` returning the same shape as the existing `GET /v1/projects/:id/usage-analytics` (search requests + token usage rows for the project). The admin endpoint SHALL bypass the org-membership check while the existing console endpoint preserves it.

#### Scenario: Admin reads usage for any project
- **WHEN** an admin requests `GET /admin/projects/:id/usage` for a project they are not a member of
- **THEN** the system SHALL return HTTP 200 with the same `{ searchRequests, tokenUsage }` payload returned to a member by the console endpoint

#### Scenario: Non-admin still gated on the console endpoint
- **WHEN** a non-admin user requests `GET /v1/projects/:id/usage-analytics` for a project they are not a member of
- **THEN** the system SHALL return HTTP 404 (current behavior preserved by the controller-level membership check)

### Requirement: GET /admin/search-requests global feed with filters
The system SHALL expose `GET /admin/search-requests?limit&offset&orgId&projectId` returning rows from `search_requests` ordered by `created_at DESC`. Each item SHALL include the search-request fields plus the project name and org name. Optional `orgId` filters to that organization's projects; optional `projectId` filters to a single project. The response envelope SHALL be `{ items, total, limit, offset }`.

#### Scenario: Returns global feed ordered by createdAt DESC
- **WHEN** an admin requests `GET /admin/search-requests`
- **THEN** the response SHALL contain the most recent search requests across all projects, ordered by `created_at DESC`

#### Scenario: orgId narrows to one org
- **WHEN** an admin requests `GET /admin/search-requests?orgId=<id>`
- **THEN** every returned item's project SHALL belong to that org

#### Scenario: projectId narrows to one project
- **WHEN** an admin requests `GET /admin/search-requests?projectId=<id>`
- **THEN** every returned item SHALL have `projectId === <id>`

#### Scenario: Combined filters
- **WHEN** an admin requests `GET /admin/search-requests?orgId=<o>&projectId=<p>`
- **THEN** the system SHALL apply both filters (project must both equal `<p>` and belong to `<o>`)

### Requirement: AnalyticsService is auth-free; membership check moved to console controller
`AnalyticsService.getUsageForProject` SHALL accept only `(projectId)` and SHALL NOT enforce any authorization. The console-facing controller (`AnalyticsController.getUsage`) SHALL perform the org-membership check before calling the service. The admin controller SHALL call the service without a membership check.

#### Scenario: Service signature
- **WHEN** any caller invokes `AnalyticsService.getUsageForProject`
- **THEN** the signature SHALL be `(projectId: string) => Promise<{ searchRequests, tokenUsage }>` with no `userId` argument and no membership lookup inside the service

#### Scenario: Console controller enforces membership
- **WHEN** an unauthenticated-as-member user calls `GET /v1/projects/:id/usage-analytics`
- **THEN** the console controller SHALL return HTTP 404 before calling the service (current behavior preserved)

### Requirement: Index supporting global search-requests feed
The system SHALL add an index on `search_requests (created_at DESC)` to support the global `/admin/search-requests` ordering without sequential scans.

#### Scenario: Index present after migration
- **WHEN** the migration adding the index has been applied
- **THEN** the database SHALL contain an index named `search_requests_created_at_desc_idx` on `search_requests (created_at DESC)`
