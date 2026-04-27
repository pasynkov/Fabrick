## ADDED Requirements

### Requirement: API health endpoint returns version
The `/health` endpoint SHALL return application version along with status by dynamically reading from package.json at runtime.

#### Scenario: Health endpoint returns version for deployed API
- **WHEN** client calls `GET /health`
- **THEN** response is `{ status: 'ok', 'app-version': '<version>' }` where version matches package.json

#### Scenario: Version reflects current deployment
- **WHEN** API application is deployed with version 0.6.7
- **THEN** `/health` endpoint returns `'app-version': '0.6.7'`

### Requirement: Package.json version reading
The API SHALL read version from package.json dynamically (not hardcoded or from environment variable).

#### Scenario: Version read from package.json
- **WHEN** API starts up
- **THEN** it reads `version` field from package.json
- **AND** uses that value for all `/health` endpoint responses
