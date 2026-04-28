## ADDED Requirements

### Requirement: Refresh token database schema
The system SHALL maintain a `refresh_tokens` table with columns: `id`, `user_id`, `token_hash`, `created_at`, `expires_at`. The token_hash SHALL store SHA-256 hashes of refresh tokens, never plaintext.

#### Scenario: Refresh token storage
- **WHEN** a refresh token is created
- **THEN** only the SHA-256 hash is stored in the database with user association and expiration

### Requirement: Refresh token generation on authentication
The system SHALL modify authentication endpoints (`/auth/login`, `/auth/register`) to return both access_token (1 hour expiry) and refresh_token (7 days expiry) in the response body.

#### Scenario: Login with refresh token
- **WHEN** a user successfully logs in
- **THEN** the response includes both `access_token` and `refresh_token` fields

#### Scenario: Registration with refresh token  
- **WHEN** a user successfully registers
- **THEN** the response includes both `access_token` and `refresh_token` fields

### Requirement: Access token refresh endpoint
The system SHALL expose `POST /auth/refresh` accepting `{ refresh_token }`. On success it SHALL return a new access token and new refresh token, invalidating the old refresh token.

#### Scenario: Successful token refresh
- **WHEN** a client sends `POST /auth/refresh` with a valid refresh token
- **THEN** the system returns HTTP 200 with new `access_token` and `refresh_token`, and invalidates the old refresh token

#### Scenario: Expired refresh token
- **WHEN** a client sends `POST /auth/refresh` with an expired refresh token
- **THEN** the system returns HTTP 401

#### Scenario: Invalid refresh token
- **WHEN** a client sends `POST /auth/refresh` with a non-existent or revoked refresh token
- **THEN** the system returns HTTP 401

### Requirement: Refresh token revocation endpoint
The system SHALL expose `POST /auth/revoke` (JWT-authenticated) that invalidates the user's current refresh token.

#### Scenario: Successful revocation
- **WHEN** an authenticated user sends `POST /auth/revoke`
- **THEN** the system deletes the user's refresh token and returns HTTP 200

#### Scenario: No refresh token to revoke
- **WHEN** an authenticated user with no active refresh token sends `POST /auth/revoke`
- **THEN** the system returns HTTP 200 (idempotent operation)

### Requirement: Automatic refresh token cleanup
The system SHALL automatically delete expired refresh tokens from the database on a daily basis to prevent storage bloat.

#### Scenario: Expired token cleanup
- **WHEN** the cleanup process runs
- **THEN** all refresh tokens with `expires_at` in the past are deleted from the database