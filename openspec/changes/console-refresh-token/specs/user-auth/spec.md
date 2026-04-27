## MODIFIED Requirements

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