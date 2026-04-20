## ADDED Requirements

### Requirement: Login command exits cleanly after auth
After successfully saving credentials, the CLI process SHALL exit with code 0.

#### Scenario: Successful login exits with 0
- **WHEN** user completes browser-based OAuth and token is received
- **THEN** credentials are saved and process exits with code 0

#### Scenario: Login timeout exits with non-zero
- **WHEN** no token is received within the timeout window
- **THEN** process exits with a non-zero exit code

### Requirement: Credentials stored in project directory
The CLI SHALL write credentials to `.fabrick/credentials.yaml` relative to the current working directory.

#### Scenario: Write credentials on login
- **WHEN** `fabrick login` completes successfully
- **THEN** `.fabrick/credentials.yaml` is created in CWD with token and api_url

#### Scenario: Read project-local credentials first
- **WHEN** both `.fabrick/credentials.yaml` (CWD) and `~/.fabrick/credentials.yaml` exist
- **THEN** CWD credentials take precedence

#### Scenario: Fall back to global credentials
- **WHEN** `.fabrick/credentials.yaml` does not exist in CWD
- **AND** `~/.fabrick/credentials.yaml` exists
- **THEN** global credentials are used

### Requirement: API requests work with HTTP localhost URLs
The CLI SHALL successfully make API requests to `http://localhost` URLs without "fetch failed" errors.

#### Scenario: Init with localhost API URL
- **WHEN** credentials contain `api_url: http://localhost:3000`
- **AND** user runs `fabrick init`
- **THEN** API requests succeed (no fetch error due to URL format)
