## ADDED Requirements

### Requirement: CLI login opens browser and captures token via localhost callback
`fabrick login` SHALL start a local HTTP server on a random OS-assigned port, generate a UUID state, open the system browser to `<apiUrl>/cli-auth?port=<port>&state=<state>`, wait for the callback, and on receiving `GET /callback?token=<token>` write the token to `~/.fabrick/credentials.yaml` and exit.

#### Scenario: Successful login flow
- **WHEN** user runs `fabrick login`
- **THEN** CLI starts local server, opens browser, waits; after user logs in on console the CLI receives the token, saves it, prints confirmation, exits

#### Scenario: Browser cannot open
- **WHEN** the system cannot open a browser
- **THEN** CLI prints the URL for manual opening and continues waiting

#### Scenario: Callback not received within 5 minutes
- **WHEN** 5 minutes pass with no callback
- **THEN** CLI prints timeout error and exits with code 1

### Requirement: Console CLI auth page issues token and redirects
The system SHALL expose `GET /console/cli-auth?port=PORT&state=STATE` (web page, served by console SPA). After successful login the page SHALL call `POST /auth/cli-token` with `{ state }`, receive the token, and redirect to `http://localhost:PORT/callback?token=TOKEN`.

#### Scenario: User logged in — token issued
- **WHEN** user is already logged into the console and visits `/cli-auth?port=PORT&state=STATE`
- **THEN** console POSTs to API, receives token, redirects to `http://localhost:PORT/callback?token=TOKEN`

#### Scenario: User not logged in
- **WHEN** user visits `/cli-auth` without a session
- **THEN** console redirects to login page, then back to `/cli-auth` after login

### Requirement: CLI credentials file
`fabrick login` SHALL write `~/.fabrick/credentials.yaml` with the following structure:

```yaml
token: <plaintext-cli-token>
api_url: <api-url>
```

#### Scenario: Credentials file written
- **WHEN** login succeeds
- **THEN** `~/.fabrick/credentials.yaml` is created or overwritten with token and api_url

#### Scenario: Credentials file permissions
- **WHEN** credentials file is written
- **THEN** file permissions are set to 0600 (owner read/write only)

### Requirement: CLI reads credentials on every command
Every CLI command that communicates with the API SHALL read `~/.fabrick/credentials.yaml` before making requests. If the file is missing or token is absent, the CLI SHALL print an error message instructing the user to run `fabrick login` and exit with code 1.

#### Scenario: No credentials file
- **WHEN** user runs `fabrick push` without having run `fabrick login`
- **THEN** CLI prints "Not authenticated. Run: fabrick login" and exits with code 1
