## MODIFIED Requirements

### Requirement: Synthesis requires explicit API key
The system SHALL NOT use environment variables as a fallback for Anthropic API keys. Synthesis jobs SHALL fail with an explicit error if no API key is configured at the project or organization level.

#### Scenario: Synthesis fails without project-level API key
- **WHEN** synthesis is triggered for a project with no API key configured at the project level and no API key at the organization level
- **THEN** the system fails the synthesis job with HTTP 400 error message: "No Anthropic API key configured. Add API key in project settings."

#### Scenario: Synthesis succeeds with project-level API key
- **WHEN** synthesis is triggered for a project with an API key configured at the project level
- **THEN** the synthesis job uses the project-level API key and processes normally

#### Scenario: Synthesis succeeds with org-level API key fallback
- **WHEN** synthesis is triggered for a project with no API key at the project level but the organization has an API key configured
- **THEN** the synthesis job uses the organization-level API key and processes normally

#### Scenario: No environment variable fallback
- **WHEN** synthesis is triggered and no project/organization API keys are configured, regardless of environment variables
- **THEN** the synthesis job fails with the explicit error (no fallback to ANTHROPIC_API_KEY environment variable)

### Requirement: Skill reads all repo contexts from downloaded folder
The skill SHALL read context files from all subdirectories of the provided `downloaded/` folder.

#### Scenario: Multiple repos are discovered
- **WHEN** `downloaded/` contains `repo-frontend/`, `repo-backend/`, `repo-devops/`
- **THEN** skill reads context files from all three

### Requirement: architecture/index.md acts as a navigation guide
The skill SHALL produce an `index.md` that maps question types to file locations.

#### Scenario: index.md guides to the right file
- **WHEN** `architecture/index.md` is read
- **THEN** it clearly states which file to read for questions about each app, env vars, or integrations

### Requirement: Per-app files are self-contained
Each app file in `architecture/apps/` SHALL contain everything needed to answer questions about that app.

#### Scenario: App file contains purpose, flows, envs, endpoints
- **WHEN** `architecture/apps/repo-backend.md` is read
- **THEN** it contains: what the app does, key business flows, env variable names and descriptions, exposed API endpoints

### Requirement: Cross-cutting concerns are documented
The skill SHALL produce files for concerns that span multiple apps.

#### Scenario: integrations.md documents inter-app connections
- **WHEN** `architecture/cross-cutting/integrations.md` is read
- **THEN** it describes which apps call which, and via what contracts

#### Scenario: envs.md aggregates all env vars
- **WHEN** `architecture/cross-cutting/envs.md` is read
- **THEN** it lists all env vars from all apps with their descriptions and which app uses them

### Requirement: Synthesis worker has no database dependency
The synthesis service SHALL NOT connect to PostgreSQL. It SHALL derive all required paths from the queue message payload. TypeORM SHALL be removed from the synthesis service entirely.

#### Scenario: Synthesis starts without DB env vars
- **WHEN** synthesis service starts with no `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASS` env vars
- **THEN** service starts successfully and processes jobs normally

#### Scenario: Synthesis resolves MinIO paths from queue message
- **WHEN** synthesis receives `{ orgSlug: "acme", projectSlug: "backend", repos: [{ slug: "api" }] }`
- **THEN** it reads context from MinIO at `acme/backend/api/context/` and writes synthesis to `acme/backend/synthesis/`
