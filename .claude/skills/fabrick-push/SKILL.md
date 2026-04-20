---
name: fabrick-push
description: Upload local .fabrick/context/ to the Fabrick backend. Delegates to the fabrick CLI. Run after fabrick-analyze has produced context files.
---

Upload the local `.fabrick/context/` to the Fabrick backend by running the CLI.

## Step 1: Check CLI is installed

```bash
fabrick --version
```

If the command is not found, install it first:

```bash
npm install -g fabrick
```

## Step 2: Push context

```bash
fabrick push
```

The CLI will:
1. Read `.fabrick/config.yaml` for repo name and backend URL
2. Zip `.fabrick/context/`
3. POST to `{backendUrl}/context/{repo}`
4. Report success or failure

## Troubleshooting

- **Config not found**: Run `fabrick init` first
- **Context not found**: Run `/fabrick-analyze` in Claude Code first, then retry
- **Connection error**: Ensure the backend is running (`docker compose up` in `applications/backend/`)
