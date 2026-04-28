## ADDED Requirements

### Requirement: User registration with email and password
The system SHALL expose `POST /auth/register` accepting `{ email, password }`. It SHALL hash the password with bcrypt (cost factor 10), create a User record, create a default Organization named after the email prefix, add the user as admin of that org, create the org's MinIO bucket, generate a refresh token, and return both a JWT access token and refresh token.

#### Scenario: Successful registration
- **WHEN** a client sends `POST /auth/register` with a valid unique email and password (min 8 chars)
- **THEN** the system creates the user, creates a default org, returns HTTP 201 with `{ access_token, refresh_token, user: { id, email } }`

#### Scenario: Duplicate email
- **WHEN** a client sends `POST /auth/register` with an email that already exists
- **THEN** the system returns HTTP 409

#### Scenario: Invalid password
- **WHEN** a client sends `POST /auth/register` with a password shorter than 8 characters
- **THEN** the system returns HTTP 400

### Requirement: User login with email and password
The system SHALL expose `POST /auth/login` accepting `{ email, password }`. On success it SHALL return both a JWT access token signed with a secret from env (expiring in 1 hour) and a refresh token (expiring in 7 days).

#### Scenario: Successful login
- **WHEN** a client sends `POST /auth/login` with correct credentials
- **THEN** the system returns HTTP 200 with `{ access_token, refresh_token, user: { id, email } }`

#### Scenario: Wrong password
- **WHEN** a client sends `POST /auth/login` with wrong password
- **THEN** the system returns HTTP 401

#### Scenario: Unknown email
- **WHEN** a client sends `POST /auth/login` with an email not in the database
- **THEN** the system returns HTTP 401

### Requirement: JWT auth guard protects authenticated endpoints
The system SHALL enforce a JWT bearer token guard on all endpoints except `/auth/*` and `/health`. Requests without a valid token SHALL be rejected.

#### Scenario: Valid token accepted
- **WHEN** a request includes `Authorization: Bearer <valid-jwt>`
- **THEN** the system processes the request and injects the authenticated user into the request context

#### Scenario: Missing token rejected
- **WHEN** a request to a protected endpoint has no Authorization header
- **THEN** the system returns HTTP 401

#### Scenario: Expired token rejected
- **WHEN** a request includes a JWT that has expired
- **THEN** the system returns HTTP 401

### Requirement: Long-lived CLI token issuance
The system SHALL expose `POST /auth/cli-token` (JWT-authenticated) that creates a long-lived opaque token for CLI use. The token SHALL be a cryptographically random 32-byte value, stored hashed (SHA-256) in the `cli_tokens` table. The plaintext token is returned once and never stored.

#### Scenario: CLI token created
- **WHEN** an authenticated user sends `POST /auth/cli-token` with a valid `state` UUID
- **THEN** the system creates a `cli_token` record, returns HTTP 201 with `{ token, state }`

#### Scenario: Existing CLI token replaced
- **WHEN** a user who already has a CLI token sends `POST /auth/cli-token`
- **THEN** the old token is deleted and a new one is returned

### Requirement: CLI token auth guard
The system SHALL provide a separate auth guard that validates a CLI token from the `Authorization: Bearer` header by hashing it (SHA-256) and looking it up in `cli_tokens`. On success it SHALL inject the associated user.

#### Scenario: Valid CLI token accepted
- **WHEN** a request to a CLI-guarded endpoint includes a valid CLI token
- **THEN** the system processes the request with the token's associated user

#### Scenario: Invalid CLI token rejected
- **WHEN** a request includes an unrecognized or revoked CLI token
- **THEN** the system returns HTTP 401
