## Why

Synthesis service directly queries PostgreSQL to resolve project/org/repo slugs from a `projectId`, creating a shared database dependency. Removing this coupling makes synthesis a stateless worker — no DB, no shared entities, easier to scale and deploy independently.

## What Changes

- Queue message for synthesis jobs expands from `{ projectId }` to `{ projectId, orgSlug, projectSlug, repos: [{ slug }] }` — all data needed to read/write MinIO
- Synthesis service removes TypeORM dependency, DB connection, and entity files
- Synthesis reports job completion via HTTP callback to API (`PATCH /internal/projects/:id/synth-status`)
- API adds internal endpoint to receive status updates from synthesis
- `synthesis/src/entities/` directory deleted (was duplicate of API entities)

## Capabilities

### New Capabilities

- `synthesis-job-contract`: Queue message schema carrying all context needed for synthesis without DB lookup

### Modified Capabilities

- `fabrick-synthesis`: Synthesis worker no longer requires DB — all inputs from queue, status via HTTP callback

## Impact

- `applications/backend/synthesis/src/` — remove TypeORM, entities, DB connection
- `applications/backend/synthesis/src/synthesis/synthesis.processor.ts` — rewrite to use queue payload
- `applications/backend/api/src/synthesis/` — enrich queue message when enqueuing, add internal status endpoint
- `applications/backend/api/src/app.module.ts` — no change (synthesis no longer shares DB config)
- No public API contract changes
