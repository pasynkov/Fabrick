## Context

Synthesis is a background worker that processes repos and produces synthesis files in MinIO. Currently it receives only `{ projectId }` in the queue message and then queries PostgreSQL to resolve slugs and repo list. This creates a shared DB dependency that couples synthesis to the API's database schema.

API already knows org slug, project slug, and all repos at the moment it triggers synthesis — it fetches them for auth and MinIO path construction anyway.

## Goals / Non-Goals

**Goals:**
- Synthesis service has no DB connection
- All data needed for synthesis carried in the queue message
- Synthesis reports job outcome via HTTP callback to API
- No public API contract changes

**Non-Goals:**
- Changing synthesis logic (Claude call, MinIO read/write, prompt)
- Queue schema versioning / backwards compatibility (no prod yet)

## Decisions

### Enrich queue message at publish time

**Decision**: API's `SynthesisService.triggerForProject` fetches org slug + all repos, packs into queue message.

Current: `{ projectId }`
New: `{ projectId, orgSlug, projectSlug, repos: [{ id, slug }], callbackToken }`

API already has project in scope at trigger time. Fetching repos adds one extra DB query — acceptable.

### Status callback via HTTP POST to API

**Decision**: Synthesis POSTs to `POST /internal/synthesis/status` with `{ projectId, status, error? }` using a capability token for auth.

Alternatives considered:
- Reply queue (synth-complete) — API would need to subscribe to queue, more moving parts
- Synthesis writes status to DB directly — defeats the purpose of decoupling
- Shared secret (`INTERNAL_API_SECRET` env var) — works but requires coordinating secrets across containers
- JWT service account — requires service user in DB, storing credentials

**Capability token pattern**: When API dispatches the job, it generates a short-lived JWT and includes it in the queue message as `callbackToken`. Synthesis uses it as `Authorization: Bearer` on the callback request.

```
API dispatch:
  callbackToken = sign({ sub: projectId, scope: "synth-callback", exp: now+1h }, JWT_SECRET)
  publish({ ..., callbackToken })

Synthesis callback:
  POST /internal/synthesis/status
  Authorization: Bearer <callbackToken>
  { projectId, status, error? }

API validates:
  - valid JWT signature (same JWT_SECRET already in use)
  - scope === "synth-callback"
  - token.sub === body.projectId
```

Why secure: token travels only through internal queue, scoped to one operation on one project, expires after 1h. No new env vars — reuses existing `JWT_SECRET`.

### No data-source.ts in synthesis

Synthesis loses all TypeORM code. `app.module.ts` drops the TypeORM import entirely. `entities/` directory deleted.

## Risks / Trade-offs

- **HTTP callback failure**: If synthesis can't reach API (network error, API down), status is lost. Mitigation: synthesis logs the error — retry/dead-letter queue is future work.
- **Queue message size**: Adding repos array is trivial in size (slugs only).
- **Capability token expiry**: If synthesis takes >1h, callback fails with 401. Mitigation: 1h is generous for synthesis jobs; can increase if needed.

## Migration Plan

1. API: fetch repos in `triggerForProject`, generate capability token, enrich queue message
2. API: add `POST /internal/synthesis/status` endpoint — validate JWT scope + sub, update project status
3. Synthesis: rewrite `synthesis.processor.ts` to use payload directly, no DB lookups, use `callbackToken` for HTTP callback
4. Synthesis: remove TypeORM from `app.module.ts`, delete `entities/`
5. Add `API_BASE_URL` env var to synthesis in `docker-compose.yml` (no new secrets needed)
