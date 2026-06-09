## ADDED Requirements

### Requirement: `fabrick sync` auto-detects per-scope mode
`fabrick sync` SHALL load `.fabrick/config.json` and `.fabrick/state.json`, compute the diff between `state.baselineSha` and `HEAD`, detect added and removed scopes, and decide per scope one of `patch`, `regen`, `delete`, or `skip` using ADR D13/D14 logic: new scopes regen, removed scopes delete, scopes whose patch/fullscan token ratio exceeds the per-scope threshold regen, scopes with no diff skip, and all others patch.

#### Scenario: New scope triggers regen
- **WHEN** scope detection finds a scope not present in `state.scopes`
- **THEN** the planned mode for that scope is `regen`

#### Scenario: Removed scope triggers delete
- **WHEN** a scope present in `state.scopes` is no longer detected
- **THEN** the planned mode for that scope is `delete`

#### Scenario: Over-threshold scope falls back to regen
- **WHEN** `estimatePatchTokens(scope) / estimateFullscanTokens(scope) > config.scan.rebuildThreshold[scope]`
- **THEN** the planned mode for that scope is `regen`

#### Scenario: Under-threshold scope patches
- **WHEN** the diff produces changed files inside the scope and the ratio is below the threshold
- **THEN** the planned mode for that scope is `patch`

#### Scenario: Empty diff exits cleanly
- **WHEN** the plan contains no `patch`, `regen`, or `delete` entries
- **THEN** the CLI prints `nothing to sync` and exits 0 without calling the LLM or backend

### Requirement: `fabrick sync` recomputes the threshold map
`fabrick sync` SHALL recompute `dynamicThreshold(fullscanTokens)` for every detected scope before mode decisions and SHALL persist the result to `config.scan.rebuildThreshold`, removing entries for scopes no longer detected.

#### Scenario: Threshold map matches detected scopes after sync
- **WHEN** a sync run completes
- **THEN** `config.scan.rebuildThreshold` contains exactly one entry per currently detected scope and no entries for removed scopes

### Requirement: `fabrick sync` runs LLM locally and posts dossier events
`fabrick sync` SHALL run the compute/apply LLM passes locally through the Claude Code subprocess wrapper, assemble a `PushDossierUpdateDto` containing `baseSha`, `headSha`, optional `prTitle` / `prNumber`, and one `scopes[]` entry per planned scope, and POST it to `/v2/repos/:repoId/dossier/events`. Each scope entry SHALL include one event per produced slug body plus a one-sentence haiku description in `meta`.

#### Scenario: POST contains all planned scopes
- **WHEN** the plan has 3 patch scopes and 1 regen scope
- **THEN** the request body's `scopes` array has length 4, each entry carrying `scope`, `mode`, and `events[]`

#### Scenario: Patch event carries instructions and bodies
- **WHEN** a scope is in `patch` mode
- **THEN** its `events[]` contains entries with `type` set to the slug, `bodies` containing only changed slug bodies, and `instructions` set to the compute patch document

#### Scenario: Regen event replaces all slugs
- **WHEN** a scope is in `regen` mode
- **THEN** its `events[]` contains exactly four entries (one per slug) with the regenerated bodies

#### Scenario: Delete event carries no bodies
- **WHEN** a scope is in `delete` mode
- **THEN** its `events[]` is empty and the scope entry tells the backend to remove the scope

### Requirement: `fabrick sync` advances state and is fire-and-forget
`fabrick sync` SHALL print the `dossierUpdatedId` returned by the backend, write `state.json.baselineSha = HEAD`, `state.json.lastSyncedAt = ISO8601(now)`, and `state.json.lastDossierUpdatedId = <id>`, and exit 0 without polling backend events. The CLI SHALL NOT advance `baselineSha` if the POST or any LLM call fails.

#### Scenario: Successful sync advances baseline
- **WHEN** the POST returns 200 and a `dossierUpdatedId`
- **THEN** `state.json.baselineSha` equals the current `HEAD`

#### Scenario: Failed POST preserves baseline
- **WHEN** the POST returns a non-2xx response
- **THEN** `state.json.baselineSha` is unchanged and the CLI exits non-zero with the response body

#### Scenario: LLM failure aborts before POST
- **WHEN** the Claude Code subprocess exits non-zero during compute or apply
- **THEN** the CLI exits non-zero, does not POST, and `state.json.baselineSha` is unchanged

### Requirement: `fabrick sync --dry-run` prints the plan without side effects
`fabrick sync --dry-run` SHALL execute steps that produce the plan (config load, scope detection, threshold recompute, mode decisions) but SHALL NOT call the LLM, SHALL NOT POST, and SHALL NOT write `state.json`. It SHALL print one row per scope with columns `scope`, `mode`, `patchTok`, `fullscanTok`, and `threshold`.

#### Scenario: Dry run prints plan
- **WHEN** `fabrick sync --dry-run` runs on a repo with two changed scopes
- **THEN** stdout contains a table with two rows, including the computed token counts and threshold, and the process exits 0

#### Scenario: Dry run does not write state
- **WHEN** `fabrick sync --dry-run` completes
- **THEN** the mtime of `.fabrick/state.json` is unchanged

### Requirement: `fabrick sync` appends one entry to the patch log
`fabrick sync` SHALL append one JSON line to `.fabrick/patches.log.jsonl` per run. The entry MUST include `at`, `title`, `baselineSha`, `headSha`, `costUsd`, and a `scopes[]` array with per-scope `mode`, `slugCounts`, `sample`, and `description`.

#### Scenario: Log entry written after successful sync
- **WHEN** `fabrick sync` completes successfully
- **THEN** the last line of `.fabrick/patches.log.jsonl` parses as JSON and contains the documented fields with the current `headSha`

### Requirement: `fabrick regen` wipes local state and emits genesis events
`fabrick regen` SHALL prompt the user `wipe all local + remote dossier? (y/N)` (skipped on `--yes`), delete `.fabrick/dossier/*`, set `state.json.baselineSha = null`, run full genesis for every detected scope, recompute `config.scan.rebuildThreshold`, and POST `/v2/repos/:repoId/dossier/events` with one `mode: 'regen'` scope entry per detected scope. After a successful POST it SHALL set `state.json.baselineSha = HEAD`.

#### Scenario: Confirmation required without `--yes`
- **WHEN** the user answers `n` (or empty) to the prompt
- **THEN** the CLI aborts, prints `aborted`, and exits 0 without touching disk or backend

#### Scenario: `--yes` skips the prompt
- **WHEN** `fabrick regen --yes` runs
- **THEN** no prompt is displayed and the destructive flow begins immediately

#### Scenario: Regen covers all scopes
- **WHEN** the repo has 6 detected scopes
- **THEN** the POST body has 6 scope entries, each in `mode: 'regen'`, and `state.json.baselineSha` equals `HEAD` after the POST succeeds
