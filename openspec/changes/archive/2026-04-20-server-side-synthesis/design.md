## Context

Backend: NestJS + TypeORM (Postgres) + MinIO. Contexts stored at `{orgSlug}/{projectSlug}/{repoSlug}/context/{file}`. Synthesis is currently a local Claude Code skill that writes files directly — this design moves it server-side.

MinIO bucket per org: `{orgSlug}`. All project/repo data lives under that bucket.

## Goals / Non-Goals

**Goals:**
- Async synthesis triggered from console, no timeout issues
- Result stored as individual files in MinIO, same bucket as context
- Prompt is a versioned asset, not hardcoded
- Simple status polling (no WebSocket, no queue for now)

**Non-Goals:**
- Per-org Anthropic keys (future)
- Queue / separate synthesis service (future — noted in design for easy extraction)
- Webhook/push notification when done (future)
- Synthesis history / versioning (future)

## Decisions

### 1. Async via fire-and-forget + DB status

`POST /projects/:id/synthesis` sets `project.synthStatus = 'running'` synchronously, then fires the synthesis job with `Promise` (no await). Status is polled via `GET /projects/:id/synthesis/status`.

Status stored on `Project` entity — no new table. Simple for MVP. When synthesis moves to a queue/worker, status can move to a job table without changing the API contract.

**Alternative considered**: in-memory job map — rejected because status lost on restart.

### 2. Prompt as NestJS asset (`synthesis-prompt.txt`)

Prompt lives in `src/assets/synthesis-prompt.txt`, copied to `dist/assets/` at build time via `nest-cli.json` (already configured for skills zip). `SynthesisService` reads it with `fs.readFileSync(join(__dirname, '..', 'assets', 'synthesis-prompt.txt'))`.

Updated by replacing the file and redeploying. No DB migration needed.

### 3. Claude response format: structured JSON

Prompt instructs Claude to return a single JSON object:
```json
{
  "files": {
    "overview.md": "# Overview\n...",
    "apps/api.md": "# api\n...",
    "cross-cutting/integrations.md": "..."
  }
}
```

`SynthesisService` parses JSON, iterates files, `putObject` each to MinIO at `{orgSlug}/{projectSlug}/synthesis/{path}`.

**Alternative considered**: markdown with `=== FILE: path ===` separators — rejected, fragile to parse.

### 4. MinIO synthesis path

```
{orgSlug}/
  {projectSlug}/
    synthesis/
      overview.md
      index.md
      apps/
        {repoSlug}.md
      cross-cutting/
        integrations.md
        envs.md
```

`GET /projects/:id/synthesis` lists objects at prefix `{projectSlug}/synthesis/` and returns file paths + content.

### 5. `getObject` on MinioService

```typescript
async getObject(bucket: string, key: string): Promise<Buffer>
```

Uses `client.getObject()` → streams to Buffer.

## Risks / Trade-offs

- **Risk**: Synthesis for large projects (many repos) may hit Anthropic context limits. → Mitigation: truncate context per repo if needed (future).
- **Risk**: Fire-and-forget means errors after response are silent. → Mitigation: store `synthStatus = 'error'` + log error message on `Project` entity.
- **Risk**: Concurrent synthesis runs for same project. → Mitigation: reject `POST` if `synthStatus === 'running'`.
