## ADDED Requirements

### Requirement: User entity carries platform-admin flag
The `User` entity SHALL include an `isPlatformAdmin: boolean` field, mapped to the `users.is_platform_admin` column. The field SHALL default to `false` on new users.

#### Scenario: New registration defaults to non-admin
- **WHEN** a user registers via `POST /auth/register`
- **THEN** the created `User` row SHALL have `is_platform_admin = false`

### Requirement: JwtStrategy populates isPlatformAdmin on request.user
`JwtStrategy.validate` SHALL look up the current `users` row by id and SHALL attach `isPlatformAdmin` (the live database value) onto the user object passed to `request.user`. The flag SHALL NOT be sourced from JWT claims.

#### Scenario: Live flag reflected on every request
- **WHEN** a request with a valid JWT is processed by `JwtStrategy.validate`
- **THEN** `request.user.isPlatformAdmin` SHALL equal the current `users.is_platform_admin` value, even if the JWT was issued before the flag was set

## MODIFIED Requirements

### Requirement: User login with email and password
The system SHALL expose `POST /auth/login` accepting `{ email, password }`. On success it SHALL return both a JWT access token signed with a secret from env (expiring in 1 hour) and a refresh token (expiring in 7 days). The login response SHALL include `user.isPlatformAdmin` so clients can branch on platform-admin status without an extra round trip.

#### Scenario: Successful login
- **WHEN** a client sends `POST /auth/login` with correct credentials
- **THEN** the system returns HTTP 200 with `{ access_token, refresh_token, user: { id, email, isPlatformAdmin } }`

#### Scenario: Wrong password
- **WHEN** a client sends `POST /auth/login` with wrong password
- **THEN** the system returns HTTP 401

#### Scenario: Unknown email
- **WHEN** a client sends `POST /auth/login` with an email not in the database
- **THEN** the system returns HTTP 401
