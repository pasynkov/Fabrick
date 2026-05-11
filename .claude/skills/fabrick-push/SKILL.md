---
name: fabrick-push
description: Upload local .fabrick/wiki/ to the Fabrick backend. Delegates to the fabrick CLI. Run after fabrick-analyze has produced wiki pages.
---

Upload the local `.fabrick/wiki/` to the Fabrick backend by running the CLI.

## Step 1: Check CLI is installed

```bash
fabrick --version
```

If the command is not found, install it first:

```bash
npm install -g @fabrick/cli
```

## Step 2: Push wiki

```bash
fabrick push
```

The CLI will:
1. Read `.fabrick/config.yaml` for repo name and backend URL
2. Zip `.fabrick/wiki/` (or per-app wikis for monorepos under `wiki/<app-name>/`)
3. POST to `{backendUrl}/repos/{repoId}/context`
4. Report success or failure

## Troubleshooting

- **Config not found**: Run `fabrick init` first
- **Wiki not found**: Run `/fabrick-analyze` in Claude Code first, then retry
- **Connection error**: Ensure the backend is running (`docker compose up` in `applications/backend/`)
