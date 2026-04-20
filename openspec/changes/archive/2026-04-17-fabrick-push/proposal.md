## Why

After `fabrick-analyze` writes context to `.fabrick/context/`, developers need a way to send that context to the Fabrick backend. This skill handles the upload: zip the context folder and POST it to the backend API.

## What Changes

- Add Claude Code skill `.claude/skills/fabrick-push/SKILL.md`
- Skill reads `.fabrick/config.yaml` for repo name and backend URL
- Zips `.fabrick/context/` in memory
- POSTs the ZIP to `POST /context/:repo` on the Fabrick backend
- Reports success or failure

## Capabilities

### New Capabilities

- `fabrick-push`: Upload local `.fabrick/context/` to the Fabrick backend as a ZIP

### Modified Capabilities

<!-- none -->

## Impact

- New file: `.claude/skills/fabrick-push/SKILL.md`
- Depends on: fabrick-analyze (produces `.fabrick/context/`), fabrick-backend-api (provides the endpoint)
- No changes to existing files
