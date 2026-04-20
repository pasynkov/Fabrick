## Why

Context is being pushed to Fabrick but synthesis only runs locally via a Claude Code skill — meaning users have to manually download contexts, run synthesis themselves, and the result never reaches the platform. Server-side synthesis closes this gap: push context, click a button, get architecture docs.

## What Changes

- `MinioService` gains `getObject()` to read individual objects
- `Project` entity gains `synthStatus` field (`idle | running | done | error`)
- New `SynthesisService` fetches all repo contexts for a project, calls Anthropic API (JSON-structured response), stores resulting files back to MinIO
- New `SynthesisModule` with three endpoints:
  - `POST /projects/:id/synthesis` — triggers async synthesis, returns immediately
  - `GET /projects/:id/synthesis/status` — polling endpoint
  - `GET /projects/:id/synthesis` — lists synthesized files with content
- `src/assets/synthesis-prompt.txt` — prompt bundled as NestJS asset, updated on release
- Console `ProjectDetail` page: "Run Synthesis" button + status polling + result display
- Anthropic API key configured via `ANTHROPIC_API_KEY` env var (single key, Fabrick-owned)

## Capabilities

### New Capabilities
- `server-side-synthesis`: Trigger, track, and retrieve AI-generated architecture synthesis from the console

### Modified Capabilities
- `context-upload`: No behavior change, but synthesis now consumes what push produces

## Impact

- `applications/backend/api/src/minio/minio.service.ts` — add `getObject()`
- `applications/backend/api/src/entities/project.entity.ts` — add `synthStatus`
- `applications/backend/api/src/synthesis/` — new module
- `applications/backend/api/src/assets/synthesis-prompt.txt` — new asset
- `applications/backend/api/src/app.module.ts` — register SynthesisModule
- `applications/backend/api/package.json` — add `@anthropic-ai/sdk`
- `applications/console/src/pages/ProjectDetail.tsx` — synthesis UI
- Deployment: `ANTHROPIC_API_KEY` env var required
