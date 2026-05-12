## ADDED Requirements

### Requirement: Login command accepts a pre-issued token via flag
The `fabrick login` command SHALL accept a `--token <value>` flag. When provided, it SHALL skip the browser-based callback server, write the token and API URL to `.fabrick/credentials.yaml`, and exit with code 0. The existing browser flow SHALL remain unchanged when `--token` is not provided.

#### Scenario: Login with --token writes credentials and exits
- **WHEN** `fabrick login --token fbrk_xxxxx` is invoked
- **THEN** `.fabrick/credentials.yaml` is written with the provided token
- **AND** the process exits with code 0 without opening a browser

#### Scenario: API URL defaults when --token used without env override
- **WHEN** `fabrick login --token fbrk_xxxxx` is invoked
- **AND** `FABRICK_API_URL` env var is not set
- **THEN** `api_url` in credentials is set to `https://api.fabrick.me`

#### Scenario: API URL taken from env when --token used
- **WHEN** `fabrick login --token fbrk_xxxxx` is invoked
- **AND** `FABRICK_API_URL=http://localhost:3000` is set
- **THEN** `api_url` in credentials is set to `http://localhost:3000`

### Requirement: Init command supports non-interactive mode
The `fabrick init` command SHALL accept `--non-interactive`, `--org <slug>`, and `--project <slug>` flags. When `--non-interactive` is set, the command SHALL resolve org and project by slug from the API (no readline prompts), default AI tool to `claude`, and write `.fabrick/config.yaml`. It SHALL fail fast with a clear error message if the org slug is not found in the user's org list.

#### Scenario: Non-interactive init writes config without prompts
- **WHEN** `fabrick init --non-interactive --org my-org --project my-project` is invoked
- **AND** the org and project exist for the authenticated user
- **THEN** `.fabrick/config.yaml` is written with correct `repo_id` and `api_url`
- **AND** no readline input is requested

#### Scenario: Non-interactive init fails when org not found
- **WHEN** `fabrick init --non-interactive --org unknown-org --project x` is invoked
- **AND** `unknown-org` is not in the user's org list
- **THEN** the command prints an error to stderr and exits with code 1

#### Scenario: Non-interactive init creates project when slug not found
- **WHEN** `fabrick init --non-interactive --org my-org --project new-project` is invoked
- **AND** `new-project` does not yet exist under the org
- **THEN** the project is created via API and config is written with the new project's repo

#### Scenario: Non-interactive init uses git remote for repo binding
- **WHEN** `fabrick init --non-interactive --org my-org --project my-project` is invoked
- **AND** the CWD has `git remote get-url origin` returning a valid URL
- **THEN** find-or-create is called with that remote URL
