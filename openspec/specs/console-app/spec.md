## ADDED Requirements

### Requirement: Console SPA bootstrapped with Vite + React + Tailwind
The console application SHALL be a standalone Vite + React + Tailwind CSS SPA located at `applications/console/`. It SHALL communicate with the API via `VITE_API_URL` env variable.

#### Scenario: Local dev
- **WHEN** developer runs `npm run dev` in `applications/console/`
- **THEN** Vite serves the app on port 5173 with hot reload

#### Scenario: Production build
- **WHEN** developer runs `npm run build`
- **THEN** Vite outputs static files to `dist/` suitable for CDN deployment

### Requirement: Login page
The console SHALL provide a `/login` page with email and password fields. On success it SHALL store the JWT access token in sessionStorage and refresh token in httpOnly cookie, then redirect to `/`.

#### Scenario: Successful login
- **WHEN** user submits correct credentials on `/login`
- **THEN** console stores access token in sessionStorage, refresh token in httpOnly cookie, and navigates to org list

#### Scenario: Failed login
- **WHEN** user submits wrong credentials
- **THEN** console displays error message, stays on `/login`

### Requirement: Register page
The console SHALL provide a `/register` page with email and password fields. On success it SHALL store the JWT access token in sessionStorage and refresh token in httpOnly cookie, then redirect to `/`.

#### Scenario: Successful registration
- **WHEN** user submits valid email and password on `/register`
- **THEN** account is created, tokens are stored securely, user is redirected to org list

### Requirement: CLI auth page
The console SHALL provide a `/cli-auth` page that reads `port` and `state` from query params. If the user is not logged in, it SHALL redirect to `/login?next=/cli-auth?...`. After login it SHALL call `POST /auth/cli-token`, receive the token, and redirect to `http://localhost:PORT/callback?token=TOKEN`. The page SHALL handle token refresh automatically if the access token expires during the flow.

#### Scenario: Authenticated user on CLI auth page
- **WHEN** user visits `/cli-auth?port=12345&state=uuid`
- **THEN** console calls API (refreshing token if needed), gets token, redirects to `http://localhost:12345/callback?token=TOKEN`

#### Scenario: Token refresh during CLI auth flow
- **WHEN** access token expires during CLI auth flow
- **THEN** console automatically refreshes token and continues with CLI token generation

### Requirement: Org list page
The console SHALL provide a `/` page listing all orgs the user belongs to with links to each org.

#### Scenario: Org list displayed
- **WHEN** authenticated user visits `/`
- **THEN** list of orgs with name, slug, and role is shown

### Requirement: Org detail page
The console SHALL provide a `/orgs/:orgSlug` page listing the org's projects and (for admins) a members section with ability to add members.

#### Scenario: Admin sees member management
- **WHEN** an admin visits the org page
- **THEN** member list and "Add Member" form (email + generated password shown once) are displayed

#### Scenario: Member sees org without member management
- **WHEN** a non-admin member visits the org page
- **THEN** only project list is shown, no member management

### Requirement: Project detail page
The console SHALL provide a `/orgs/:orgSlug/projects/:projectSlug` page listing the project's repositories.

#### Scenario: Repo list displayed
- **WHEN** user visits project page
- **THEN** list of repos with name, slug, and git remote is shown
