## ADDED Requirements

### Requirement: Config schema is `.fabrick/config.json`
The CLI SHALL read and write configuration as JSON at `.fabrick/config.json`. The file MUST contain `version`, `orgSlug`, `projectId`, `projectSlug`, `repoId`, `repoName`, `gitRemote`, `agent`, `apiUrl`, and a `scan` object with `ignore: string[]` and `rebuildThreshold: Record<string, number>`. The `agent` value MUST be one of `claude`, `codex`, `gemini`, `none`. YAML configs SHALL NOT be read or written.

#### Scenario: Loader rejects YAML config
- **WHEN** `.fabrick/config.yaml` exists and `.fabrick/config.json` is missing
- **THEN** the CLI exits non-zero with a message instructing the user to run `fabrick init`

#### Scenario: Loader rejects malformed JSON
- **WHEN** `.fabrick/config.json` exists but cannot be parsed or fails schema validation
- **THEN** the CLI exits non-zero with a message naming the missing or invalid field

#### Scenario: Loader returns parsed config
- **WHEN** `.fabrick/config.json` exists and satisfies the schema
- **THEN** every command that needs config receives a typed object with the documented fields

### Requirement: `fabrick init` runs an interactive flow
`fabrick init` SHALL prompt for API URL (default `https://api.fabrick.me/`), select an organization, select or create a project, confirm the repository name (derived from `git remote get-url origin`), select an AI agent, and ask whether to bootstrap routing rules inline.

#### Scenario: Defaults applied when user presses enter
- **WHEN** the user accepts the API URL prompt with no input
- **THEN** `apiUrl` is set to `https://api.fabrick.me/`

#### Scenario: Project is created when none exist
- **WHEN** the chosen organization has no projects
- **THEN** the CLI prompts for a new project name and creates it via the backend before continuing

#### Scenario: Repo name defaults to remote
- **WHEN** the prompt for repository name is shown
- **THEN** the default value is derived from `git remote get-url origin` (ssh URLs are normalised to https) and pressing enter accepts it

#### Scenario: Inline bootstrap on confirmation
- **WHEN** the user answers `y` to the bootstrap prompt
- **THEN** `fabrick bootstrap` runs to completion before `init` exits

### Requirement: `fabrick init` writes config and sidecars
`fabrick init` SHALL write `.fabrick/config.json`, `.mcp.json`, and install Claude skills into `.claude/skills/`. The config MUST contain every field in the schema, including an empty `scan.rebuildThreshold` map that will be populated by `bootstrap`/`sync`/`regen`.

#### Scenario: Files written after successful init
- **WHEN** `fabrick init` completes
- **THEN** `.fabrick/config.json`, `.mcp.json`, and `.claude/skills/fabrick-*/` are present on disk

#### Scenario: Existing config overwrite confirmation
- **WHEN** `.fabrick/config.json` already exists and the user did not pass `--yes`
- **THEN** the CLI asks `Overwrite .fabrick/config.json? (y/N)` and aborts on `n`

### Requirement: `fabrick init --non-interactive` accepts org and project flags
`fabrick init --non-interactive` SHALL accept `--org <slug>`, `--project <slug>`, `--api-url <url>`, and `--agent <name>` and SHALL exit non-zero if any required argument is missing.

#### Scenario: All flags supplied
- **WHEN** `fabrick init --non-interactive --org acme --project platform --api-url https://api.fabrick.me/`
- **THEN** the CLI runs the same write phase as the interactive path without prompts

#### Scenario: Missing required flag
- **WHEN** `--non-interactive` is passed without `--org` or `--project`
- **THEN** the CLI exits non-zero and prints which flag is missing

### Requirement: `fabrick bootstrap` derives routing rules
`fabrick bootstrap` SHALL run the bootstrap-routing skill against the current repository and emit `.fabrick/routing-rules.json`, `.fabrick/file-slug-map.json`, and `.fabrick/state.json` (`baselineSha = null`, populated `scopes` array). It SHALL copy the bootstrap-routing skill into `.fabrick/skills/bootstrap-routing/`.

#### Scenario: Bootstrap writes outputs
- **WHEN** `fabrick bootstrap` succeeds
- **THEN** `routing-rules.json`, `file-slug-map.json`, `state.json`, and `skills/bootstrap-routing/SKILL.md` exist under `.fabrick/`

#### Scenario: Bootstrap recomputes threshold map
- **WHEN** `fabrick bootstrap` finishes
- **THEN** `config.scan.rebuildThreshold` is rewritten with one entry per detected scope using `dynamicThreshold(fullscanTokens)`
