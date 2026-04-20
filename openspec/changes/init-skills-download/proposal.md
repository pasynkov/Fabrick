## Why

`fabrick init` registers a repo but doesn't install Claude skills — users have to find and copy them manually. The three core skills (`fabrick-analyze`, `fabrick-push`, `fabrick-search`) are the entry point to the entire Fabrick workflow. Without them, init is half-done.

## What Changes

- Backend bundles `fabrick-analyze`, `fabrick-push`, `fabrick-search` as `claude-skills.zip` (NestJS asset)
- New endpoint `GET /skills/claude` returns the zip (CLI token auth)
- `fabrick init` asks which AI tool the user uses (Claude only for now)
- After repo registration, CLI downloads and extracts the zip into `.claude/skills/`
- Extraction rule: overwrite only `fabrick-*` prefixed skill directories; skip everything else
- `ai_tool: claude` written to `.fabrick/config.yaml`

## Capabilities

### New Capabilities
- `skills-distribution`: Bundling, serving, and installing Fabrick CLI skills on init

### Modified Capabilities
- `cli-auth-flow`: `init` command gains AI tool selection step and skills download

## Impact

- `applications/backend/api/src/assets/claude-skills.zip` — new file (bundled asset)
- `applications/backend/api/nest-cli.json` — add assets config
- `applications/backend/api/src/skills/skills.controller.ts` — new endpoint
- `applications/backend/api/src/skills/skills.module.ts` — new module
- `applications/cli/src/init.command.ts` — AI tool prompt + download + extract
- `applications/cli/package.json` — add `adm-zip` or use `unzipper` (already in backend, not CLI)
- `.fabrick/config.yaml` format gains `ai_tool` field
