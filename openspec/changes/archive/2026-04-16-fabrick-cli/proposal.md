## Why

Developers using Fabrick need a frictionless way to initialize a project and push repository context to the backend without manually managing config files or skill installations. A global npm CLI removes all setup ceremony.

## What Changes

- Add new npm package `fabrick` (global CLI) at `applications/cli/`
- `fabrick init`: interactive setup — selects AI tool (Claude Code), prompts project name, writes `.fabrick/config.yaml`, installs skills into `.claude/skills/`
- `fabrick push`: reads config, zips `.fabrick/context/`, POSTs to backend `/context/:repo`
- Embed `fabrick-analyze` SKILL.md inside the CLI package (copied on `init`)
- Update `fabrick-push` SKILL.md to delegate to `fabrick push` CLI command
- Backend URL hardcoded to `http://localhost:3000` (no auth for MVP)

## Capabilities

### New Capabilities

- `cli-init`: Interactive project initialization — AI tool selection, project naming, config write, skill installation
- `cli-push`: Zip `.fabrick/context/` and upload to backend via multipart POST

### Modified Capabilities

- `fabrick-push`: Skill now delegates to `fabrick push` CLI instead of running curl directly

## Impact

- New directory: `applications/cli/`
- New global binary: `fabrick`
- `.claude/skills/fabrick-analyze/SKILL.md` installed locally per project by `fabrick init`
- `.claude/skills/fabrick-push/SKILL.md` updated — calls CLI instead of direct curl
- `.fabrick/config.yaml` written per project (existing format unchanged)
- No changes to backend API
