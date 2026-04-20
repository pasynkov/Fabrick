## Context

This is a Claude Code skill — it runs inside a developer's repository where `fabrick-analyze` has already been executed. The skill needs to zip `.fabrick/context/` and POST it to the backend. Since it's a Claude Code skill, it can use Bash to run curl or node one-liners.

## Goals / Non-Goals

**Goals:**
- Zip `.fabrick/context/` and upload to backend
- Read config from `.fabrick/config.yaml`
- Give clear feedback on success/failure

**Non-Goals:**
- Auth / tokens
- Retry logic
- Incremental/delta uploads
- Validating context contents

## Decisions

### Use curl for upload
The skill runs in Bash via Claude Code. `curl` is universally available and handles multipart file upload cleanly with one command. No extra dependencies needed.

```bash
zip -r /tmp/fabrick-context.zip .fabrick/context/
curl -s -o /dev/null -w "%{http_code}" \
  -F "file=@/tmp/fabrick-context.zip" \
  http://localhost:3000/context/my-repo
```

### Config from .fabrick/config.yaml
```yaml
project: my-project
repo: backend
backendUrl: http://localhost:3000
```

Repo name from `repo` field → used as `:repo` path param.

### Temp file for zip
Using `/tmp/fabrick-context.zip` is fine for a PoC. In-memory zip isn't practical from a shell script. The file is small (only derived context, no source code).

## Risks / Trade-offs

- Temp file left in `/tmp` after push → acceptable for PoC
- No auth → fine for local dev scenario
- Backend URL hardcoded default → overridable via config
