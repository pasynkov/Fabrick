## ADDED Requirements

### Requirement: CLI rewritten in TypeScript with NestJS + nest-commander
The CLI at `applications/cli/` SHALL be rewritten in TypeScript. It SHALL use NestJS application context (no HTTP server) bootstrapped via `NestFactory.createApplicationContext()` and nest-commander for command registration. The `bin/fabrick` entry point SHALL invoke this bootstrap.

#### Scenario: CLI boots
- **WHEN** user runs `fabrick --help`
- **THEN** CLI bootstraps NestJS context and displays available commands

### Requirement: `fabrick login` command
The CLI SHALL implement a `login` command that executes the browser-based auth flow (see cli-auth-flow spec) and writes `~/.fabrick/credentials.yaml`.

#### Scenario: Login command invoked
- **WHEN** user runs `fabrick login`
- **THEN** browser opens, token captured, credentials written, success message printed

### Requirement: `fabrick init` command
`fabrick init` SHALL:
1. Read `~/.fabrick/credentials.yaml`; exit with error if missing
2. Get current git remote (`git remote get-url origin`); exit if not a git repo or no remote
3. Prompt user to select org and project (interactive list from API)
4. Call `POST /repos/find-or-create` with normalized git remote and selected projectId
5. Write `.fabrick/config.yaml` with `repo_id` and `api_url`

#### Scenario: First-time init in a git repo
- **WHEN** authenticated user runs `fabrick init` in a git repo with an `origin` remote
- **THEN** CLI fetches orgs/projects, prompts user to select, creates or finds repo, writes `.fabrick/config.yaml`

#### Scenario: Not a git repo
- **WHEN** user runs `fabrick init` in a directory with no git remote
- **THEN** CLI prints error "No git remote found" and exits with code 1

#### Scenario: Config already exists
- **WHEN** `.fabrick/config.yaml` already exists
- **THEN** CLI prompts to confirm overwrite before proceeding

### Requirement: `fabrick push` command
`fabrick push` SHALL read `~/.fabrick/credentials.yaml` and `.fabrick/config.yaml`, then upload a ZIP of `.fabrick/context/` to `POST /repos/:repoId/context` with `Authorization: Bearer <cli-token>`.

#### Scenario: Successful push
- **WHEN** authenticated user runs `fabrick push` with valid config and context files present
- **THEN** CLI zips `.fabrick/context/`, POSTs to API, prints success on HTTP 201

#### Scenario: No config file
- **WHEN** `.fabrick/config.yaml` is missing
- **THEN** CLI prints "Not initialized. Run: fabrick init" and exits with code 1

### Requirement: CLI compiled and distributed via npm
The CLI SHALL be compilable with `tsc` and the `bin/fabrick` entry SHALL be executable. The `package.json` SHALL declare the `fabrick` binary.

#### Scenario: npm install and run
- **WHEN** user installs `@fabrick/cli` globally and runs `fabrick`
- **THEN** CLI is available and functional
