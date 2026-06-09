## Context

Two pieces of context drive this design.

First, the v2 backend (`applications/backend/api/src/v2/`) is event-sourced. Repos own a Dossier aggregate; projects own a Compendium aggregate. The dossier write surface accepts a single `POST /v2/repos/:repoId/dossier/events` with a list of per-scope inputs (`{ scope, mode: 'patch' | 'regen' | 'delete', events: [{ type, title, bodies, instructions, meta }] }`). The compendium is recomputed on the backend in response to `DossierUpdated`, so the CLI is responsible only for the dossier write path. Reads are plain GETs on `/v2/repos/:id/dossier`, `/v2/projects/:id/compendium`, `/v2/projects/:id/events`, and `/v2/projects/:id/search`.

Second, the incremental-lab in `applications/incremental-lab/` has validated the local-compute pipeline described in `docs/ADR-001-fabrick-pipeline.md`. Tree-sitter lifts source into symbols, `simple-git` produces diffs, `claude -p` runs the compute (sonnet) and apply (haiku) passes, the markdown extractor produces `fingerprintHash` for synthesis filtering, and a byte-based heuristic (`dynamicThreshold`) decides between patch and full regen per scope. The lab also writes a `patches.log.jsonl` audit trail and a one-sentence haiku-authored description per scope (ADR D15, D16).

The current production CLI (`applications/cli/`) is built on `nest-commander` with a v1 zip-upload flow (`fabrick push`) and a YAML config. That surface is incompatible with v2 and does not host the lab pipeline.

This design defines how to fold the lab pipeline into the production CLI, switch to the v2 event API, and present a focused command set whose interactive style matches the openspec CLI.

## Goals / Non-Goals

**Goals:**

- Provide a single auto-detecting `fabrick sync` that turns a git diff into dossier events and POSTs them to v2.
- Provide an explicit `fabrick regen` that wipes local and remote dossier state and emits genesis events.
- Preserve ADR decisions D1–D16 in the production CLI: tree-sitter extractors, per-app scope detection, 4-slug taxonomy, two-phase compute/apply, evidence-link enforcement, frontmatter stamping, deterministic index pages, fingerprint-based filtering, the warm Claude Code cache, the cost-driven rebuild threshold, the patch log, and the one-sentence haiku description per scope.
- Match the openspec-cli interaction style for `fabrick init` (numeric selects, simple confirms, default-bracketed text prompts).
- Make local iteration on the CLI a single command (`npm run install:local`).

**Non-Goals:**

- No backend changes — the v2 API is treated as fixed.
- No follow / SSE for the events feed; `fabrick events` returns the last 20.
- No partial `regen` — `fabrick regen` is all-scopes only.
- No backwards-compatibility shim for v1 (`fabrick push`) or for `.fabrick/config.yaml`.
- No extracted shared package; lab modules are copied into the CLI and adapted.
- No CLI-side compendium LLM compute — compendium is recomputed by the backend on `DossierUpdated`.

## Decisions

### D1. NestJS + nest-commander stays, lab modules are ported as plain TS

The current CLI already uses `nest-commander` to wire commands into a `CliModule`. New commands (`SyncCommand`, `RegenCommand`, `StatusCommand`, `EventsCommand`, `SearchCommand`, `DossierCommand`, `CompendiumCommand`, `ConfigCommand`, `LogoutCommand`, `WhoamiCommand`, `BootstrapCommand`) follow the same pattern.

The lab's pipeline modules (`src/extract/*`, `src/scope/*`, `src/snapshot/*`, `src/diff/*`, `src/llm/*`, `src/wiki/*`, `src/synthesis/*` that are dossier-relevant, `src/util/*`, `src/validate/*`) are ported to `applications/cli/src/pipeline/`. They are plain TypeScript functions injected through small NestJS providers (`PipelineService`, `ClaudeCodeService`, `ExtractorService`, `ThresholdService`, `PatchLogService`) so commands can stay thin.

**Alternatives considered:**
- A standalone `bin/fabrick.js` without Nest, to match the lab shape. Rejected — losing DI makes test wiring harder and the existing `init`/`login` commands already depend on Nest providers.
- Extracting a shared `@fabrick/pipeline` package. Rejected — adds release coupling for one consumer and contradicts the explicit non-goal.

### D2. Config is `.fabrick/config.json`, no YAML, no auto-migration

The new config is JSON only. If the loader finds `.fabrick/config.yaml` and no `.fabrick/config.json`, it prints a hard error pointing to `fabrick init`. There is no auto-migration: the v2 schema introduces fields (`orgSlug`, `projectId`, `projectSlug`, `repoId`, `repoName`, `gitRemote`, `agent`, `apiUrl`, `scan.ignore`, `scan.rebuildThreshold`) that aren't present in v1 and that require backend lookups to fill in.

`scan.rebuildThreshold` is a per-scope map (ADR D14): `{ "<scope-root>": number }`. The value is the clamped log-curve output of `dynamicThreshold(fullscanTotalTok)` for that scope. Threshold is recomputed by `fabrick sync`, `fabrick regen`, and `fabrick bootstrap` and persisted to the same file.

**Alternatives considered:**
- Auto-migrate YAML → JSON. Rejected — the v1 YAML doesn't carry the v2 fields, so the user would still need to answer the init prompts; a hard error is clearer.
- A single global threshold. Rejected — fullscan token count varies per scope, so a single number over-rebuilds small scopes and under-rebuilds large ones.

### D3. Sync is one command, not a wizard

`fabrick sync` is the only incremental flow. It performs, in order:

1. Load `.fabrick/config.json` and `.fabrick/state.json`. Reject if either is missing.
2. Run `simpleGit` to read `HEAD` and `git diff baselineSha..HEAD --name-only`.
3. Re-run scope detection (`nest-cli.json` and kustomize tree); diff against `state.scopes` to find added / removed scopes.
4. For every scope (existing or new), recompute `dynamicThreshold(fullscanTokens)` and write the updated map into `config.scan.rebuildThreshold`.
5. Per scope, decide mode:
   - new scope or `baselineSha == null` → `regen`
   - scope removed → `delete`
   - otherwise, compare `estimatePatchTokens / estimateFullscanTokens` against the per-scope threshold; over threshold → `regen`, under → `patch`, no diff → skip.
6. Run LLM in parallel per scope. `regen` is one sonnet call producing four slug bodies. `patch` is sonnet compute → haiku apply (ADR D5). All calls go through the Claude Code subprocess wrapper (`claude -p` with `--system-prompt`, `--tools ""`, `--disable-slash-commands`, `--settings {enabledPlugins:{caveman:false}}`).
7. For every produced scope, run one haiku call that consumes the symbol diff and emits a one-sentence description (ADR D16). Append a single JSON line to `.fabrick/patches.log.jsonl`.
8. Build `PushDossierUpdateDto` — each scope entry contains the per-slug events (`type` is the page slug, `title` is the slug label, `bodies` is the new page body keyed by slug, `instructions` carries the compute patch document, `meta` carries cost and token counts and the haiku description).
9. POST `/v2/repos/:repoId/dossier/events`. Print the returned `dossierUpdatedId`. Do not poll.
10. Write `state.json.baselineSha = HEAD`, `state.json.lastSyncedAt = now`, `state.json.lastDossierUpdatedId = <id>`.

On empty diff (no scopes change), step 5 produces an empty plan and the CLI exits 0 with `nothing to sync` before the LLM is touched.

`fabrick sync --dry-run` runs steps 1–5, prints the plan as a table (`scope | mode | patchTok / fullscanTok | threshold`), and exits 0. It does not call the LLM or backend.

**Alternatives considered:**
- A long-running `fabrick sync --watch`. Rejected — out of scope and out of step with fire-and-forget semantics.
- A separate `fabrick scope detect` step. Rejected — scope detection is cheap and there's no value in surfacing it.

### D4. Regen is destructive and gated

`fabrick regen` performs:

1. Prompt `wipe all local + remote dossier? (y/N)`. Skip on `--yes`.
2. Delete `.fabrick/dossier/*` (do not touch `routing-rules.json`, `file-slug-map.json`, or `skills/`).
3. Set `state.json.baselineSha = null` and clear `state.json.lastDossierUpdatedId`.
4. Run full genesis for every detected scope in parallel (sonnet, one call per scope, four slug bodies emitted).
5. Recompute `dynamicThreshold` per scope and write `config.scan.rebuildThreshold`.
6. POST `/v2/repos/:repoId/dossier/events` with one scope entry per detected scope, `mode: 'regen'`, and events containing the regenerated bodies.
7. Set `state.json.baselineSha = HEAD` and `state.json.lastDossierUpdatedId = <id>`.

There is no partial regen. The backend resolves `mode: 'regen'` by replacing all four slugs for the scope (`DossierRegenApplied`).

### D5. Auth: keep cookie-style creds, add `whoami` and `logout`

`fabrick login` already writes the token and `api_url` via `CredentialsService`. `fabrick logout` calls `CredentialsService.clear()`. `fabrick whoami` calls `GET /me` against the stored `api_url` and prints user, orgs, and the resolved CLI version.

The `api_url` source priority is unchanged: `config.apiUrl` overrides credential `api_url`, which overrides the default `https://api.fabrick.me/`. `fabrick init` is the only command that prompts for the URL.

### D6. Views are plain GETs with `--remote` opt-in

`fabrick dossier [scope]`, `fabrick compendium`, and `fabrick events` default to reading the local cache so they work offline. `--remote` forces a backend GET. `fabrick status` is always local (it doesn't need the backend to report the baseline). `fabrick search` is always remote.

`fabrick events` calls `GET /v2/projects/:projectId/events?limit=20`. Optional flags map to `--since` and `--types`. There is no follow.

`fabrick config` is a thin wrapper: `get a.b.c`, `set a.b.c value`, and `path`. `set` writes via the same atomic-rename pattern as `state.json`. Numeric and boolean coercion is detected from the input string.

### D7. Claude Code subprocess wrapper lives in CLI, single warm path

The wrapper (`pipeline/claude-code.service.ts`) spawns `claude -p` with the lab's flag set. The CLI process is the warm-cache holder per ADR D12 — calls within an hour reuse the cached system prompt. The wrapper accepts model (`claude-sonnet-4-6` or `claude-haiku-4-5`), system prompt, user input, and tool list. It exposes both a one-shot call and a parallel-pool helper used by sync, regen, and the per-scope description pass.

The wrapper is the only place that knows about `claude` flags. No retries on non-zero exit — failure surfaces as a typed error, the sync run aborts, and `state.json.baselineSha` is not advanced.

### D8. Install: `npm run install:local`

`applications/cli/package.json` gains `"install:local": "npm run build && npm install -g ."`. The script builds TypeScript via `tsc` (the existing `build` script) and then installs the package globally from the working directory. No prepublish hook is changed.

### D9. Open-question — events feed filter syntax

`--types` is comma-separated on the command line and forwarded as the same string to the API (the v2 controller already parses it). `--since` is forwarded raw. There is no schema validation in the CLI; if the user passes a bad value the API rejects it and the CLI prints the response body.

## Risks / Trade-offs

- **Hard break for v1 users** → mitigation: clear error in the new loader pointing to `fabrick init`, and a release note. Users without local v1 configs are unaffected.
- **LLM cost blow-up if sync misclassifies a huge diff as patch** → mitigation: ADR D13 + D14 already address this — a too-large patch trips the threshold and falls back to regen. The patch log records the decision so cost regressions are visible.
- **Fire-and-forget hides backend failures** → mitigation: the CLI inspects the POST response only for HTTP errors. The backend persists `DossierUpdateFired` synchronously; any downstream failure is visible via `fabrick events` once the user looks. Acceptable because the alternative (poll) blocks CI for minutes.
- **Claude Code is a runtime requirement** → mitigation: `init` checks for `claude` on PATH and warns. The wrapper surfaces a typed error if `claude` is missing.
- **Per-scope threshold storage drifts when scopes are renamed** → mitigation: sync rewrites the threshold map on every run; stale keys for removed scopes are dropped at write time.
- **Tree-sitter native bindings on Windows / Apple Silicon** → mitigation: same risk the lab already carries; the CLI inherits whatever the lab uses. We don't widen the supported matrix.

## Migration Plan

There is no in-place migration. The release notes will instruct users to:

1. Update the CLI (`npm i -g @fabrick/cli@<new>`).
2. Delete `.fabrick/config.yaml` if it exists.
3. Run `fabrick init`.
4. Run `fabrick bootstrap` (or accept the inline bootstrap from `init`).
5. Run `fabrick regen` to seed the dossier on the v2 backend.

Rollback is `npm i -g @fabrick/cli@<previous>`; the v1 CLI is unchanged and the v1 backend endpoints still exist.

## Open Questions

- Does the new CLI need to surface compendium status (e.g., last compendium event id) in `fabrick status`? Initial answer: no — compendium is backend-triggered and not part of the user's local state. Revisit after we have user feedback.
- Should `fabrick sync` emit a final summary line that mimics the `patches.log.jsonl` entry? Initial answer: yes, one-line summary printed after the POST succeeds, with the same haiku description.
