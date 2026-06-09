## ADDED Requirements

### Requirement: `fabrick logout` is part of the auth surface
The CLI SHALL expose `fabrick logout` alongside `fabrick login`. `logout` SHALL delete the project-local `.fabrick/credentials.yaml` if present, leave the global `~/.fabrick/credentials.yaml` untouched, and exit 0 whether or not a file existed.

#### Scenario: Logout exits cleanly with no creds
- **WHEN** `fabrick logout` runs with no `.fabrick/credentials.yaml` in CWD
- **THEN** the process exits 0 with a message indicating nothing to remove

#### Scenario: Logout removes project-local creds only
- **WHEN** both `.fabrick/credentials.yaml` (CWD) and `~/.fabrick/credentials.yaml` exist
- **THEN** only the CWD file is deleted and the process exits 0

### Requirement: `fabrick whoami` belongs to the auth surface
The CLI SHALL expose `fabrick whoami` that reads stored credentials, calls the v2 identity endpoint, and prints the user identifier, optional email, and organisations. It SHALL exit non-zero when no credentials are present or the backend returns 401.

#### Scenario: Whoami with valid creds
- **WHEN** stored credentials authenticate against the backend
- **THEN** stdout includes the user identifier and one line per organisation

#### Scenario: Whoami without credentials
- **WHEN** no credentials are found
- **THEN** the process exits non-zero with a message instructing the user to run `fabrick login`
