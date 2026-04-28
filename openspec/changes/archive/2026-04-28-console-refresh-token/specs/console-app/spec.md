## MODIFIED Requirements

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