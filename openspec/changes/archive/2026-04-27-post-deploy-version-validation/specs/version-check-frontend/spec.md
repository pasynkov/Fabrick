## ADDED Requirements

### Requirement: Frontend health.json file generated during build
Each frontend application SHALL generate a `/health.json` file in static assets during Vite build containing version information.

#### Scenario: health.json is created during Vite build
- **WHEN** Vite build process completes
- **THEN** `/health.json` file exists in the output static assets directory
- **AND** file contains `{ "version": "<version>" }` where version matches package.json

#### Scenario: health.json is accessible at root
- **WHEN** frontend application is deployed to Azure Static Web App
- **THEN** client can access `/health.json` via HTTP
- **AND** response contains version matching deployment

### Requirement: Version sourced from package.json during build
The version in `/health.json` SHALL be read from package.json at build time.

#### Scenario: Version reflects build-time package.json
- **WHEN** Vite build executes
- **THEN** version is extracted from package.json `version` field
- **AND** written to health.json as part of build output
