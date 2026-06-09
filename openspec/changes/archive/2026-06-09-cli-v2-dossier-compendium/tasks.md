## 1. Project scaffold

- [x] 1.1 Add tree-sitter (`tree-sitter`, `tree-sitter-typescript`, `tree-sitter-yaml`), `simple-git`, and `js-yaml` to `applications/cli/package.json` dependencies
- [x] 1.2 Add `install:local` script in `applications/cli/package.json` (`npm run build && npm install -g .`) and verify `tsc` config compiles the new layout
- [x] 1.3 Create directory layout under `applications/cli/src/`: `pipeline/`, `commands/v2/`, `services/`
- [x] 1.4 Remove `push.command.ts`, `scan.command.ts`, `rebuild-source-map.command.ts`, `wiki/affected-pages.ts`, `wiki/hash-scanner*.ts`, `wiki/source-map*.ts` and their references in `cli.module.ts`
- [x] 1.5 Delete the now-orphaned v1 push e2e tests under `applications/cli/test/`

## 2. Config and state

- [x] 2.1 Define `ConfigSchema` TypeScript type and Zod-style runtime validator covering `version`, `orgSlug`, `projectId`, `projectSlug`, `repoId`, `repoName`, `gitRemote`, `agent`, `apiUrl`, `scan.ignore`, `scan.rebuildThreshold`
- [x] 2.2 Implement `ConfigService` with `load()`, `save()` (atomic write via temp + rename), `get(path)`, `set(path, value)` operating on `.fabrick/config.json`
- [x] 2.3 In `ConfigService.load()`, hard-error when `.fabrick/config.yaml` exists without `.fabrick/config.json`, pointing the user to `fabrick init`
- [x] 2.4 Define `StateSchema` (`baselineSha`, `scopes[]`, `lastSyncedAt`, `lastDossierUpdatedId`) and implement `StateService` with atomic read/write at `.fabrick/state.json`
- [x] 2.5 Add unit tests for `ConfigService` (load valid, reject YAML-only, schema rejection) and `StateService` (atomic write, missing-file defaults)

## 3. Auth surface

- [x] 3.1 Implement `LogoutCommand` that removes `.fabrick/credentials.yaml` (CWD only) and is idempotent
- [x] 3.2 Implement `WhoamiCommand` that calls the identity endpoint via `ApiService`, prints user id + email + orgs, and exits non-zero on 401 / missing creds
- [x] 3.3 Wire `LogoutCommand` and `WhoamiCommand` into `CliModule`
- [x] 3.4 Unit tests for both commands (mock `CredentialsService` + `ApiService`)

## 4. Local pipeline port

- [x] 4.1 Port TypeScript extractor from `applications/incremental-lab/src/extract/` to `applications/cli/src/pipeline/extract/typescript.ts`, preserving symbol shape
- [x] 4.2 Port YAML extractor to `applications/cli/src/pipeline/extract/yaml.ts`
- [x] 4.3 Port markdown extractor with `bodyHash` + `fingerprintHash` to `applications/cli/src/pipeline/extract/markdown.ts`
- [x] 4.4 Port scope detection (`nest-cli.json`, kustomize) to `applications/cli/src/pipeline/scope/`
- [x] 4.5 Port snapshot builder (`tree-sitter` over scope source) to `applications/cli/src/pipeline/snapshot/`
- [x] 4.6 Implement `dynamicThreshold(fullscanTokens)` per ADR D14 with anchor-point unit tests (1k→0.30, 8k→0.50, 50k→0.70, 500k→0.90, clamps at 0.30/0.90)
- [x] 4.7 Port byte-based `estimateFullscanTokens` and `estimatePatchTokens` heuristics
- [x] 4.8 Implement `ClaudeCodeService` wrapper around `claude -p` with `--system-prompt`, `--tools ""`, `--disable-slash-commands`, `--settings {enabledPlugins:{caveman:false}}`, accepting model + system prompt + user input + tools, returning typed result, surfacing non-zero exits as typed errors
- [x] 4.9 Port compute / apply prompts (sonnet compute, haiku apply) into `applications/cli/src/pipeline/llm/`
- [x] 4.10 Implement `FrontmatterService` that stamps `name`, `description`, `type`, `repo`, `scope`, `slug`, `sha`, `updatedAt` on every page body before write
- [x] 4.11 Implement deterministic `IndexService` that emits `index.md` from per-slug frontmatter
- [x] 4.12 Implement `PatchLogService` that appends one JSON line per run to `.fabrick/patches.log.jsonl`
- [x] 4.13 Implement haiku-driven `SummarizeScopeService` that produces a ≤30-word description from `renderMarkdownDiff` output and bounds the result
- [x] 4.14 Unit tests for extractors (TS class+decorator, YAML kustomize fields, markdown paraphrase vs link change), `dynamicThreshold`, frontmatter stamp, index emission, patch log shape

## 5. Bootstrap command

- [x] 5.1 Implement `BootstrapCommand` that runs the bootstrap-routing skill via `ClaudeCodeService`, writes `.fabrick/routing-rules.json`, derives `file-slug-map.json`, populates `.fabrick/state.json` (`baselineSha = null`, `scopes` array), and copies the skill into `.fabrick/skills/bootstrap-routing/`
- [x] 5.2 Recompute per-scope `dynamicThreshold` from fresh fullscan tokens and persist `config.scan.rebuildThreshold`
- [ ] 5.3 Unit tests covering successful bootstrap (mock LLM), threshold map population, missing skill error

## 6. Init command (v2)

- [x] 6.1 Replace `init.command.ts` with the v2 flow: prompt API URL (default `https://api.fabrick.me/`), select org, select/create project, confirm repo name from `git remote`, select agent (claude/codex/gemini/none), ask inline-bootstrap question
- [x] 6.2 Write `.fabrick/config.json` via `ConfigService` (JSON only, no YAML)
- [x] 6.3 Write `.mcp.json` with `FABRICK_API_URL` matching `config.apiUrl`
- [x] 6.4 Install `.claude/skills/fabrick-*` via the existing skill download path
- [x] 6.5 Implement `--non-interactive` mode with `--org`, `--project`, `--api-url`, `--agent`, `--yes` flags; error on missing required flags
- [x] 6.6 Confirm overwrite when `.fabrick/config.json` exists (skipped on `--yes`)
- [x] 6.7 Run `fabrick bootstrap` inline when user answers `y`
- [ ] 6.8 E2E test for interactive flow (using piped stdin) and non-interactive flow

## 7. Sync command

- [x] 7.1 Implement `SyncCommand` orchestrator that wires Config + State + Pipeline services
- [x] 7.2 Implement plan builder: load config/state, run `simple-git` to read `HEAD` and `git diff baselineSha..HEAD --name-only`, detect scopes, decide per-scope mode (`patch | regen | delete | skip`) using `dynamicThreshold`
- [x] 7.3 Recompute and persist `config.scan.rebuildThreshold` for current scopes, drop stale keys
- [x] 7.4 Empty-plan branch: print `nothing to sync`, exit 0
- [x] 7.5 Implement parallel per-scope execution: regen (sonnet genesis → four slugs), patch (sonnet compute → haiku apply → changed slugs only)
- [x] 7.6 Run per-scope haiku description pass and append `.fabrick/patches.log.jsonl` entry
- [x] 7.7 Assemble `PushDossierUpdateDto` with `baseSha`, `headSha`, optional `prTitle`/`prNumber` (`--pr=N`, `--title=...`), and per-scope event arrays
- [x] 7.8 POST `/v2/repos/:repoId/dossier/events` via `ApiService`, print returned `dossierUpdatedId`, write `state.json` (`baselineSha = HEAD`, `lastSyncedAt`, `lastDossierUpdatedId`)
- [x] 7.9 Abort without state advance on LLM or POST failure (typed errors → non-zero exit)
- [x] 7.10 Implement `--dry-run`: print plan table (`scope | mode | patchTok | fullscanTok | threshold`) without LLM or backend, no state write
- [x] 7.11 Unit tests covering plan decisions, threshold persistence, empty-plan exit
- [ ] 7.12 E2E test with mocked Claude Code and backend that verifies request shape, state advance, and `--dry-run` no-side-effect

## 8. Regen command

- [x] 8.1 Implement `RegenCommand`: confirm prompt (`wipe all local + remote dossier? (y/N)`), `--yes` to skip
- [x] 8.2 Delete `.fabrick/dossier/*`, set `state.baselineSha = null`, clear `state.lastDossierUpdatedId`
- [x] 8.3 Run genesis for every detected scope (parallel sonnet calls), recompute thresholds, persist
- [x] 8.4 POST `/v2/repos/:repoId/dossier/events` with one `mode: 'regen'` entry per scope, advance `state.baselineSha = HEAD`
- [ ] 8.5 Unit tests for prompt path, `--yes`, wipe behaviour
- [ ] 8.6 E2E test for full regen happy path with mocked LLM + backend

## 9. View commands

- [x] 9.1 Implement `StatusCommand` printing repo identifier, `baselineSha`, dirty scopes (from `git diff`), `lastSyncedAt`, `lastDossierUpdatedId`
- [x] 9.2 Implement `EventsCommand` calling `GET /v2/projects/:projectId/events?limit=20` with optional `--since`, `--types`; print compact one-liners
- [x] 9.3 Implement `SearchCommand` posting `{ question, reasoning }` to `/v2/projects/:projectId/search`; default `reasoning=false`, `--reasoning` flips it; print answer + sources
- [x] 9.4 Implement `DossierCommand` reading local `.fabrick/dossier/<scope>/*.md` by default; `--remote` GETs `/v2/repos/:repoId/dossier`; positional `scope` filters output
- [x] 9.5 Implement `CompendiumCommand` reading local `.fabrick/compendium/`; `--remote` GETs `/v2/projects/:projectId/compendium`; error if neither path is available
- [x] 9.6 Implement `ConfigCommand` (`get <path>`, `set <path> <value>`, `path`) using `ConfigService`; coerce booleans/numbers/JSON literals from string input
- [x] 9.7 Unit tests for each command (mock `ApiService` and disk reads)

## 10. Module wiring and binary

- [x] 10.1 Update `cli.module.ts` to register every new command and service; remove the dropped commands
- [x] 10.2 Update `bin/fabrick.js` entry to forward `--help` consistently
- [x] 10.3 Ensure `npm run build` produces a usable `dist/` and `bin/fabrick.js` runs the v2 CLI
- [ ] 10.4 Verify `npm run install:local` installs a working `fabrick` binary

## 11. Documentation

- [x] 11.1 Update `applications/cli/README.md` with the v2 command list, JSON config schema, and migration notes (delete YAML, re-init)
- [ ] 11.2 Add a top-level release-notes blurb for the breaking change (location: existing release notes file or new entry under `docs/`)

## 12. Validation

- [ ] 12.1 Run `openspec validate cli-v2-dossier-compendium --strict` and resolve any failures
- [x] 12.2 Run `npm test` and `npm run test:e2e` in `applications/cli`; ensure all suites pass
- [ ] 12.3 Manual smoke test against a sandbox repo: `init` → `bootstrap` → `regen` → edit → `sync --dry-run` → `sync` → `status` → `events` → `search`
