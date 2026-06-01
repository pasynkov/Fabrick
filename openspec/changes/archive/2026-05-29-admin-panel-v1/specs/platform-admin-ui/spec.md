## ADDED Requirements

### Requirement: Standalone admin Vite+React application
The repository SHALL contain a new Vite+React application at `applications/admin/` with its own `package.json`, `vite.config.ts`, `tsconfig.json`, and `src/` tree. The build SHALL emit assets under `dist/` configured with `base: '/admin/'` so all asset URLs are prefixed `/admin/`. The app SHALL emit `health.json` containing `{ version }` matching its own `package.json` (mirroring the console pattern).

#### Scenario: Build produces /admin-relative assets
- **WHEN** `npm run build` runs in `applications/admin/`
- **THEN** the resulting `dist/index.html` SHALL reference assets via `/admin/assets/...`
- **AND** `dist/health.json` SHALL contain `{ "version": "<package.json version>" }`

#### Scenario: Dev server runs in isolation
- **WHEN** a developer runs `npm run dev` in `applications/admin/`
- **THEN** the app SHALL start a Vite dev server pointing at the local API and serving the admin SPA

### Requirement: Reuses console JWT authentication
The admin app SHALL NOT define its own login form. It SHALL read the JWT and refresh token from the same storage used by the console. On boot it SHALL call `GET /me` (or the existing equivalent that the console already uses) and SHALL gate all routes on `isPlatformAdmin === true`.

#### Scenario: Unauthenticated visit bounces back to login
- **WHEN** a visitor opens any `/admin/*` route without a stored JWT
- **THEN** the admin SPA SHALL redirect them to the console login route, preserving `?return_to=/admin/...` so they land back on admin after login

#### Scenario: Authenticated non-admin bounces to root
- **WHEN** a user whose `/me` response has `isPlatformAdmin === false` opens `/admin`
- **THEN** the admin SPA SHALL redirect them to `/` (the console root)

#### Scenario: Authenticated admin stays
- **WHEN** a user whose `/me` response has `isPlatformAdmin === true` opens `/admin`
- **THEN** the admin SPA SHALL render its UI without further redirects

### Requirement: Console redirects platform admins to /admin after login
On successful login (or on any console-route load where the stored JWT identifies a platform admin), the console SHALL redirect to `/admin`. The redirect SHALL respect a `return_to` query parameter when present.

#### Scenario: Fresh admin login lands on /admin
- **WHEN** a user logs into the console and their `/me` payload has `isPlatformAdmin === true`
- **THEN** the console SHALL navigate to `/admin`

#### Scenario: Return-to honored
- **WHEN** the console login is invoked with `?return_to=/admin/projects/abc` and login succeeds for a platform admin
- **THEN** the console SHALL navigate to `/admin/projects/abc`

#### Scenario: Non-admin login unchanged
- **WHEN** a non-platform-admin logs into the console
- **THEN** the console SHALL behave exactly as before (no `/admin` redirect)

### Requirement: Tab navigation with four top-level views
The admin SPA SHALL render a persistent top-of-page tab bar with exactly four tabs in this order: `Users`, `Orgs`, `Projects`, `Searches`. Each tab maps to a route under `/admin`:
- `/admin/users` → Users tab
- `/admin/orgs` → Orgs tab
- `/admin/projects` → Projects tab
- `/admin/searches` → Searches tab

#### Scenario: Default route opens Users tab
- **WHEN** an admin opens `/admin` with no further path
- **THEN** the SPA SHALL render the Users tab and the URL SHALL resolve to `/admin/users`

#### Scenario: Active tab reflects current route
- **WHEN** the URL is `/admin/searches`
- **THEN** the Searches tab SHALL be visually marked active

### Requirement: Plain lists show every entity field
Each list view (Users, Orgs, Projects, Searches) SHALL render a table of all entity fields returned by the corresponding `/admin/*` endpoint. The lists SHALL be fixed-sorted by `createdAt DESC`. There SHALL NOT be column-header sorting controls, badges marking the admin's own row, or persisted filter state in `localStorage`.

#### Scenario: Users list shows all fields
- **WHEN** the Users tab loads
- **THEN** the table SHALL render one row per user with columns for every field returned by `GET /admin/users` (including `isPlatformAdmin`)
- **AND** the admin's own row SHALL appear with no special highlight

#### Scenario: Searches list shows all fields plus project and org
- **WHEN** the Searches tab loads
- **THEN** the table SHALL render columns for every search-request field plus the project name and org name

### Requirement: Limit/offset pagination on every list
Each list view SHALL paginate via `limit`/`offset` query parameters reflected in the URL, defaulting to `limit=50, offset=0`. The UI SHALL provide previous/next controls and SHALL display "showing N–M of T" where T is the `total` from the API response. Changing tabs SHALL reset pagination to the first page.

#### Scenario: Next page advances offset
- **WHEN** the admin clicks "Next" on the Users tab at `offset=0&limit=50`
- **THEN** the URL SHALL change to `offset=50&limit=50` and the table SHALL refetch
- **AND** the "showing N–M of T" line SHALL update accordingly

#### Scenario: Disabled controls at bounds
- **WHEN** the current page is the first page
- **THEN** the "Previous" button SHALL be disabled
- **AND** when the current page is the last page, the "Next" button SHALL be disabled

### Requirement: Searches tab provides org and project dropdown filters
The Searches tab SHALL render two filter dropdowns: one listing all organizations, one listing all projects. Selecting a value SHALL set the corresponding query parameter (`orgId` or `projectId`) and re-fetch. The two filters SHALL be independent (combining them applies both filters server-side). The Searches tab SHALL NOT expose a date-range picker in v1.

#### Scenario: Filter by org narrows to that org's projects
- **WHEN** the admin selects an org from the Org dropdown
- **THEN** the table SHALL show only search requests whose project belongs to that org
- **AND** the URL SHALL carry `?orgId=<id>`

#### Scenario: Both filters combine
- **WHEN** the admin selects both an org and a project
- **THEN** the request to `GET /admin/search-requests` SHALL include both `orgId` and `projectId`

#### Scenario: Clearing a filter
- **WHEN** the admin sets a filter dropdown back to "All"
- **THEN** the corresponding query parameter SHALL be removed from the URL and the request

### Requirement: Drill-down navigation between entities
The admin SPA SHALL support click-through navigation:
- From a row in the Users list, clicking the user SHALL navigate to a user-detail view that lists the user's organizations.
- From a row in the Orgs list (or from the user-detail's org list), clicking an org SHALL navigate to an org-detail view that lists its projects.
- From a row in the Projects list (or from the org-detail's project list), clicking a project SHALL navigate to a project-detail view showing project metadata, the project's search requests, and its token usage rows.

#### Scenario: User → orgs
- **WHEN** the admin clicks a user row in the Users list
- **THEN** the SPA SHALL navigate to `/admin/users/:id` and display the list of organizations that user belongs to

#### Scenario: Org → projects
- **WHEN** the admin clicks an org from any place it is listed
- **THEN** the SPA SHALL navigate to `/admin/orgs/:id` and display that org's projects (and members)

#### Scenario: Project → usage
- **WHEN** the admin clicks a project from any place it is listed
- **THEN** the SPA SHALL navigate to `/admin/projects/:id` and display the project's metadata plus its `GET /admin/projects/:id/usage` payload (search requests + token usage)

### Requirement: Health endpoint accessible under /admin/health.json
The admin SPA's `dist/` output SHALL include a `health.json` file that is served at `https://console.fabrick.me/admin/health.json` after deployment. The file SHALL contain `{ "version": "<admin package.json version>" }`.

#### Scenario: Production health.json reachable
- **WHEN** a client GETs `https://console.fabrick.me/admin/health.json`
- **THEN** the response SHALL be HTTP 200 with a JSON body containing `version`
