## ADDED Requirements

### Requirement: Config file written
The skill SHALL write `.fabrick/config.yaml` with project metadata derived from the folder name.

#### Scenario: Config created from folder name
- **WHEN** skill runs in `/projects/my-backend/`
- **THEN** `.fabrick/config.yaml` contains `project: my-backend` and `repo: my-backend`

### Requirement: Rule-based extraction produces YAML files
The skill SHALL extract structured data from the project using deterministic rules.

#### Scenario: endpoints.yaml created for Node.js project
- **WHEN** skill runs in a NestJS or Express project
- **THEN** `.fabrick/context/endpoints.yaml` contains discovered routes with method and path

#### Scenario: envs.yaml contains only variable names
- **WHEN** skill runs in any project
- **THEN** `.fabrick/context/envs.yaml` lists env variable names found in code — no values

#### Scenario: dependencies.yaml extracted from manifest
- **WHEN** `package.json` or `requirements.txt` exists
- **THEN** `.fabrick/context/dependencies.yaml` lists direct dependencies

### Requirement: Claude generates narrative context from code
The skill SHALL use Claude to produce human-readable summaries based on actual source code.

#### Scenario: overview.md describes what the app does
- **WHEN** skill completes analysis
- **THEN** `.fabrick/context/overview.md` contains a 1-page description of the app's purpose

#### Scenario: logic.md describes key business flows
- **WHEN** skill completes analysis
- **THEN** `.fabrick/context/logic.md` describes key flows extracted from code (not README)

### Requirement: No source code written to context
The skill SHALL NOT include raw source code in any output file.

#### Scenario: Context files contain only derived data
- **WHEN** `.fabrick/context/` is inspected after analysis
- **THEN** no file contains raw source code — only metadata, names, and descriptions
