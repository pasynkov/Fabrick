## ADDED Requirements

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
