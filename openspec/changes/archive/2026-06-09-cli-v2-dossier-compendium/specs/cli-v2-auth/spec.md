## ADDED Requirements

### Requirement: `fabrick logout` clears credentials
`fabrick logout` SHALL delete the project-local `.fabrick/credentials.yaml` and SHALL NOT touch the global `~/.fabrick/credentials.yaml`. It SHALL exit 0 even if no project-local file exists.

#### Scenario: Logout removes project-local creds
- **WHEN** `.fabrick/credentials.yaml` exists and `fabrick logout` runs
- **THEN** the file is removed and the process exits 0

#### Scenario: Logout is idempotent
- **WHEN** `.fabrick/credentials.yaml` does not exist and `fabrick logout` runs
- **THEN** the process exits 0 with a message indicating nothing to remove

#### Scenario: Logout leaves global creds untouched
- **WHEN** `~/.fabrick/credentials.yaml` exists alongside the project-local file
- **THEN** only the project-local file is removed

### Requirement: `fabrick whoami` prints the authenticated identity
`fabrick whoami` SHALL call `GET /me` (or the equivalent v2 identity endpoint) using the stored credentials and print the user identifier, email if available, and the list of organisations with their slugs. It SHALL exit non-zero if no credentials are present.

#### Scenario: Whoami prints user and orgs
- **WHEN** credentials are valid and `fabrick whoami` runs
- **THEN** stdout includes the user id, optional email, and `org-name (org-slug)` lines

#### Scenario: Whoami without credentials
- **WHEN** no credentials are found in CWD or globally and `fabrick whoami` runs
- **THEN** the process exits non-zero with a message instructing the user to run `fabrick login`

#### Scenario: Whoami surfaces invalid credentials
- **WHEN** the backend returns 401
- **THEN** the process exits non-zero with the response message and a hint to re-run `fabrick login`
