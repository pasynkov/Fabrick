## ADDED Requirements

### Requirement: `fabrick status` prints local sync state
`fabrick status` SHALL read `.fabrick/config.json` and `.fabrick/state.json` and print the resolved repo identifier, current `baselineSha`, dirty scopes (scopes whose `git diff baselineSha..HEAD` is non-empty), `lastSyncedAt`, and `lastDossierUpdatedId`. It SHALL NOT call the backend.

#### Scenario: Status reflects local state
- **WHEN** `fabrick status` runs after a sync
- **THEN** stdout shows the same `dossierUpdatedId` that was returned by the previous sync

#### Scenario: Status lists dirty scopes
- **WHEN** the user edits files under a scope and runs `fabrick status`
- **THEN** that scope appears in the dirty scopes section

### Requirement: `fabrick events` lists project events
`fabrick events` SHALL GET `/v2/projects/:projectId/events?limit=20` using the project id from config, accept optional `--since <iso>` and `--types <csv>` flags that are forwarded as query parameters, and print one line per event with `id`, `type`, `repo`, `createdAt`, and a short title.

#### Scenario: Default limit is 20
- **WHEN** `fabrick events` runs without flags
- **THEN** the request URL contains `limit=20` and no more than 20 lines are printed

#### Scenario: Types flag is forwarded as-is
- **WHEN** `fabrick events --types DossierUpdated,DossierPatchApplied`
- **THEN** the request URL contains `types=DossierUpdated,DossierPatchApplied`

#### Scenario: No follow flag
- **WHEN** `fabrick events` returns
- **THEN** the process exits 0 and does not poll the backend again

### Requirement: `fabrick search` posts to v2 search
`fabrick search "<question>"` SHALL POST `/v2/projects/:projectId/search` with body `{ question, reasoning }`. The `reasoning` flag SHALL default to `false`, and `--reasoning` SHALL set it to `true`. The CLI SHALL print the response answer and source list.

#### Scenario: Default search request
- **WHEN** `fabrick search "where is the auth middleware"`
- **THEN** the POST body is `{ "question": "where is the auth middleware", "reasoning": false }`

#### Scenario: Reasoning flag toggles body
- **WHEN** `fabrick search "..." --reasoning`
- **THEN** the POST body has `reasoning: true`

#### Scenario: Sources are printed
- **WHEN** the response contains a `sources` array
- **THEN** each source is printed on its own line under a `sources:` header

### Requirement: `fabrick dossier` reads local cache by default
`fabrick dossier [scope]` SHALL print page bodies from `.fabrick/dossier/` by default. When `--remote` is passed it SHALL GET `/v2/repos/:repoId/dossier` and print the response instead. A scope argument SHALL filter output to that scope only.

#### Scenario: Local read prints local pages
- **WHEN** `fabrick dossier apps/api`
- **THEN** stdout contains the bodies of `service.md`, `contracts.md`, `config.md`, and `integrations.md` from `.fabrick/dossier/apps/api/`

#### Scenario: Remote read calls backend
- **WHEN** `fabrick dossier --remote`
- **THEN** the CLI calls `GET /v2/repos/:repoId/dossier` and prints the server response

### Requirement: `fabrick compendium` reads local cache by default
`fabrick compendium` SHALL print compendium pages from `.fabrick/compendium/` by default. When `--remote` is passed it SHALL GET `/v2/projects/:projectId/compendium` and print the response instead.

#### Scenario: Local read prints local compendium
- **WHEN** `.fabrick/compendium/` contains compendium pages and `fabrick compendium` runs
- **THEN** stdout contains those page bodies

#### Scenario: Remote read calls backend
- **WHEN** `fabrick compendium --remote`
- **THEN** the CLI calls `GET /v2/projects/:projectId/compendium` and prints the server response

#### Scenario: Missing local cache without --remote
- **WHEN** `.fabrick/compendium/` does not exist and `--remote` is not passed
- **THEN** the CLI exits non-zero with a message suggesting `--remote`

### Requirement: `fabrick config` exposes get / set / path
`fabrick config get <dotted.path>` SHALL print the resolved value from `.fabrick/config.json`. `fabrick config set <dotted.path> <value>` SHALL update the config atomically (write to a temp file and rename), coercing booleans and numbers from the string input. `fabrick config path` SHALL print the absolute config path.

#### Scenario: Get returns the resolved value
- **WHEN** `fabrick config get apiUrl`
- **THEN** stdout is the current `apiUrl` value with no trailing newline beyond a single `\n`

#### Scenario: Set coerces booleans
- **WHEN** `fabrick config set scan.ignore '["*.spec.ts"]'`
- **THEN** the JSON file holds `scan.ignore = ["*.spec.ts"]`

#### Scenario: Path prints absolute path
- **WHEN** `fabrick config path`
- **THEN** stdout is the absolute path to `.fabrick/config.json`
