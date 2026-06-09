# @fabrick/cli — v2

The Fabrick CLI drives the v2 event-sourced dossier API. It runs the local LLM pipeline (tree-sitter extractors, Claude Code subprocess), assembles `PushDossierUpdateDto` events, and posts them to `POST /v2/repos/:repoId/dossier/events`.

## Installation

```bash
npm install -g @fabrick/cli
# or build locally:
npm run install:local
```

## Commands

| Command | Description |
|---|---|
| `fabrick login [--token <tok>]` | Authenticate with Fabrick |
| `fabrick logout` | Remove project-local credentials |
| `fabrick whoami` | Print authenticated identity |
| `fabrick init` | Interactive initialization (v2) |
| `fabrick bootstrap` | Derive routing rules and file-slug map |
| `fabrick sync [--dry-run] [--pr N] [--title T]` | Incremental dossier sync |
| `fabrick regen [--yes]` | Full dossier regeneration |
| `fabrick status` | Print local sync state |
| `fabrick events [--since <iso>] [--types <csv>]` | List project events |
| `fabrick search "<question>" [--reasoning]` | Search the dossier |
| `fabrick dossier [scope] [--remote]` | Print dossier pages |
| `fabrick compendium [--remote]` | Print compendium pages |
| `fabrick config get <path>` | Get config value |
| `fabrick config set <path> <value>` | Set config value |
| `fabrick config path` | Print config file path |

## Config schema (`.fabrick/config.json`)

```json
{
  "version": 2,
  "orgSlug": "acme",
  "projectId": "uuid",
  "projectSlug": "platform",
  "repoId": "uuid",
  "repoName": "monorepo",
  "gitRemote": "https://github.com/acme/monorepo.git",
  "agent": "claude",
  "apiUrl": "https://api.fabrick.me/",
  "scan": {
    "ignore": [],
    "rebuildThreshold": {}
  }
}
```

`agent` must be one of: `claude`, `codex`, `gemini`, `none`.

`scan.rebuildThreshold` is a per-scope map populated automatically by `bootstrap`, `sync`, and `regen`.

## Migration from v1

1. Update the CLI: `npm i -g @fabrick/cli@<new>`
2. Delete `.fabrick/config.yaml` if it exists
3. Run `fabrick init` to create `.fabrick/config.json`
4. Run `fabrick bootstrap` (or accept the inline bootstrap from `init`)
5. Run `fabrick regen` to seed the dossier on the v2 backend

> **Breaking changes in v2:**
> - `fabrick push` is removed. Use `fabrick sync` instead.
> - `fabrick scan` is removed (internal to `sync`).
> - `fabrick rebuild-source-map` is removed.
> - Config migrated from `.fabrick/config.yaml` to `.fabrick/config.json`. Old YAML is not auto-migrated.
