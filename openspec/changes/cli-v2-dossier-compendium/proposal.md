## Why

The Fabrick CLI currently uses the v1 zip-upload flow (`fabrick push`) against an older backend surface. The backend has shipped a v2 event-sourced API (dossier per repo, compendium per project, project events feed, v2 search) and the incremental-lab has validated a per-PR LLM pipeline that emits semantic events instead of zips. Without rewriting the CLI, users cannot drive the new backend, cannot benefit from per-scope patch/regen decisions, and cannot integrate with the event feed.

This change replaces the v1 CLI surface with a focused v2 CLI: one auto-detecting `sync` command for incremental updates, an explicit `regen` for full rebuilds, lightweight read commands for the new backend resources, and an interactive `init` that matches the openspec-cli interaction style.

## What Changes

- **BREAKING** Remove `fabrick push` (v1 zip flow). No backwards-compatibility shim.
- **BREAKING** Remove `fabrick rebuild-source-map`.
- **BREAKING** Migrate config from `.fabrick/config.yaml` to `.fabrick/config.json` with v2 fields (`orgSlug`, `projectId`, `projectSlug`, `repoId`, `repoName`, `gitRemote`, `agent`, `apiUrl`, `scan.ignore`, `scan.rebuildThreshold`). Old YAML is not auto-migrated.
- **BREAKING** `fabrick scan` becomes an internal helper used by `sync`; the public command is removed.
- Add interactive `fabrick init`: prompts for API URL (default `https://api.fabrick.me/`), org, project (select or create), repo name (derived from git remote), AI agent (Claude / Codex / Gemini / None), and an optional inline bootstrap. Writes `.fabrick/config.json`, `.mcp.json`, and installs `.claude/skills/`.
- Add `fabrick bootstrap`: one LLM call that derives `routing-rules.json` and the per-scope file→slug map; copies the `bootstrap-routing` skill into `.fabrick/skills/`. Ported from `applications/incremental-lab`.
- Add `fabrick sync`: reads config + state, computes the per-scope diff against `baselineSha`, recomputes per-scope `rebuildThreshold` (ADR D14 dynamic curve), decides per scope `patch | regen | delete`, runs the LLM locally via the Claude Code subprocess, assembles a `PushDossierUpdateDto`, fires `POST /v2/repos/:repoId/dossier/events`, prints the returned `dossierUpdatedId`, and advances `state.json.baselineSha` to HEAD. Fire-and-forget — no polling.
- Add `fabrick sync --dry-run`: prints the planned per-scope mode and token estimate without calling the LLM or backend.
- Add `fabrick sync` empty-diff behavior: exit 0 with `nothing to sync`.
- Add `fabrick regen`: confirms with a `y/N` prompt (skipped by `--yes`), wipes `.fabrick/dossier/*` and `state.json.baselineSha`, runs full genesis for every scope in parallel, recomputes `rebuildThreshold`, posts events with `mode: 'regen'` for every scope, and advances `baselineSha`.
- Add `fabrick status`: prints `baselineSha`, dirty scopes, `lastSyncedAt`, and `lastDossierUpdatedId`.
- Add `fabrick events`: lists the last 20 project events (project resolved from config). No follow mode.
- Add `fabrick search "<question>" [--reasoning]`: posts to `POST /v2/projects/:projectId/search` and prints the answer plus sources.
- Add `fabrick dossier [scope] [--remote]`: prints the local cache by default, falls back to `GET /v2/repos/:repoId/dossier` with `--remote`.
- Add `fabrick compendium [--remote]`: prints the local cache by default, falls back to `GET /v2/projects/:projectId/compendium` with `--remote`.
- Add `fabrick config <get|set|path>`: dotted-path get/set against `.fabrick/config.json`, plus `path` for the resolved config path.
- Add `fabrick logout` and `fabrick whoami` to the auth surface (existing `fabrick login` is kept).
- Port the local LLM compute layer from `applications/incremental-lab` into the CLI: tree-sitter TS/YAML extractors, markdown extractor with `fingerprintHash`, `dynamicThreshold(fullscanTokens)`, the Claude Code subprocess wrapper, and the patch log writer (`.fabrick/patches.log.jsonl`).
- Add `install:local` script in `applications/cli/package.json`: `npm run build && npm install -g .`.

Out of scope: the lab itself (`applications/incremental-lab` stays as a research box), backend API changes (already shipped), the MCP package, GitHub Actions workflows, and extracting a shared `@fabrick/pipeline` package (modules are copied and adapted, not extracted).

## Capabilities

### New Capabilities

- `cli-v2-config-and-init`: `.fabrick/config.json` schema, `fabrick init` interactive flow with API-URL prompt and org/project/agent selection, `.mcp.json` emission, skills install, and the inline `fabrick bootstrap` invocation.
- `cli-v2-sync`: `fabrick sync` auto-detect pipeline (diff → threshold → per-scope mode decision → LLM compute → events POST → state advance), `--dry-run` plan output, empty-diff behavior, and `fabrick regen` full-rebuild flow with confirm prompt.
- `cli-v2-views`: `fabrick status`, `fabrick events`, `fabrick search`, `fabrick dossier`, `fabrick compendium`, and `fabrick config` read/inspect commands.
- `cli-v2-auth`: `fabrick login` (kept), `fabrick logout`, and `fabrick whoami`.
- `cli-v2-local-pipeline`: tree-sitter TS/YAML extractors, markdown fingerprint extractor, `dynamicThreshold` curve, Claude Code subprocess wrapper, `PushDossierUpdateDto` assembly, and the patch log writer.
- `cli-v2-install-script`: `install:local` npm script that builds the CLI and installs it globally for local iteration.

### Modified Capabilities

- `fabrick-push`: capability is removed in this change (no v1 push surface remains).
- `fabrick-init-mcp`: init command is replaced — JSON config replaces YAML, v2 fields are added, and the API-URL prompt is introduced.
- `cli-auth-flow`: extended to cover `logout` and `whoami` in addition to `login`.
- `wiki-hash-scanner`: scanning is no longer exposed as a public command; it remains as an internal helper consumed by `fabrick sync`.

## Impact

- **Affected code**: `applications/cli/` is rewritten end-to-end — `init.command.ts`, `push.command.ts`, `scan.command.ts`, `rebuild-source-map.command.ts`, `cli.module.ts`, `config.js`, `wiki/*` are replaced or removed; new command files are added for `sync`, `regen`, `status`, `events`, `search`, `dossier`, `compendium`, `config`, `logout`, `whoami`, `bootstrap`; new directories under `applications/cli/src/pipeline/` host the ported extractors, threshold function, Claude Code wrapper, and patch log.
- **Affected APIs**: CLI now calls v2 endpoints only — `POST /v2/repos/:repoId/dossier/events`, `GET /v2/repos/:repoId/dossier`, `GET /v2/projects/:projectId/compendium`, `GET /v2/projects/:projectId/events`, `POST /v2/projects/:projectId/search`. v1 `POST /v1/repos/:id/context` is no longer called.
- **Affected config**: `.fabrick/config.yaml` is no longer read or written. `.fabrick/config.json`, `.fabrick/state.json`, `.fabrick/routing-rules.json`, `.fabrick/file-slug-map.json`, `.fabrick/dossier/<scope>/...`, `.fabrick/skills/bootstrap-routing/`, and `.fabrick/patches.log.jsonl` are the new on-disk surface.
- **Dependencies**: `applications/cli/package.json` gains tree-sitter (`tree-sitter`, `tree-sitter-typescript`, `tree-sitter-yaml`), `simple-git`, `js-yaml`, and the Claude Code CLI as a runtime peer (already required by the lab). The `yaml` dependency stays for now because YAML reading is still needed for nest-cli/kustomize parsing.
- **Users**: anyone with an existing `.fabrick/config.yaml` must re-run `fabrick init`. Anyone scripted against `fabrick push` or `fabrick scan` must migrate to `fabrick sync`.
- **Lab**: `applications/incremental-lab` is untouched; the port copies modules rather than extracting a shared package, so the lab continues to work standalone for research.
