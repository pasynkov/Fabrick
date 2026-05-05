## MODIFIED Requirements

### Requirement: Login command exits cleanly after auth
After successfully saving credentials, the CLI process SHALL exit with code 0. This applies to both browser-based OAuth and token-flag flows.

#### Scenario: Successful login exits with 0 (browser flow)
- **WHEN** user completes browser-based OAuth and token is received
- **THEN** credentials are saved and process exits with code 0

#### Scenario: Login timeout exits with non-zero
- **WHEN** no token is received within the timeout window
- **THEN** process exits with a non-zero exit code

#### Scenario: Login with --token exits with 0
- **WHEN** `fabrick login --token fbrk_xxxxx` is invoked
- **THEN** credentials are saved and process exits with code 0 without starting the callback server
