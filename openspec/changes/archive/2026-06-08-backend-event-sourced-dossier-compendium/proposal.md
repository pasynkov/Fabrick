## Why

Today the backend stores wiki pages as a project-level synthesis result and ingests CLI uploads as opaque zips. That gives us no visible history of how documentation evolves and no per-repository materialized state. To turn the Fabrick incremental pipeline (ADR-001) into a real product surface, we need an append-only event log that records every patch and regen the CLI performs, and that drives cross-repo compendium synthesis asynchronously without coupling the API to a queue subscription (the API runs inside an Azure Function).

## What Changes

- Introduce a `v2` controller namespace inside `applications/backend/api/src/v2/` that lives side-by-side with the existing v1 controllers. v1 endpoints stay untouched.
- Add a new append-only `project_events` table (ULID id, parent_id cascade chain, jsonb payload) that records every dossier and compendium lifecycle event.
- Add two materialized-view tables: `dossier_pages` (per repository) and `compendium_pages` (per project, replacing the v1 `WikiPage` usage for new clients).
- Introduce `Dossier` (per repository) and `Compendium` (per project) as NestJS CQRS `AggregateRoot`s, emitting domain events through `EventBus`.
- Add a single centralized `PersistEventHandler` that subscribes to every domain event and writes the corresponding `project_events` row — handlers never touch the events table directly.
- Add a CLI push endpoint `POST /v2/repos/:repoId/dossier/events` that accepts a batch of scope-level patch/regen/delete events plus a repo-level roll-up and persists them inside a single CQRS command.
- Cascade compendium regeneration on each `DossierUpdated`: API builds an input bundle, uploads it to Azure Blob, persists `CompendiumRegenFired`, and publishes a `type: 'compendium-event'` job onto the existing `synthesis-jobs` queue.
- Extend the `backend/synthesis` worker to dispatch by `msg.type`: a new compendium-event branch downloads the bundle (sha256-verified), runs sonnet+sonnet+haiku LLM calls with Anthropic prompt-cache breakpoints, uploads the result bundle, and HTTP-callbacks the API with a JWT.
- Add `POST /v2/internal/compendium/callback` that verifies the JWT, downloads the result bundle, persists four compendium events (`PatchComputed`, `RegenApplied`, `Described`, `Updated`), upserts `compendium_pages`, and deletes both bundles.
- Add timeline read endpoints `GET /v2/{orgs|projects|repos}/:id/events` with `since`/`limit`/`types` filters, plus `GET /v2/repos/:id/dossier` and `GET /v2/projects/:id/compendium` for materialized snapshots.
- Adopt an event lifecycle naming convention (`Fired` / `Computed` / `Applied` / `Described` / `Updated`) so the frontend can render a linear timeline by filtering `type LIKE '%Updated'`.
- Add `@nestjs/cqrs` to `applications/backend/package.json`.

Explicitly out of scope for this change (deferred to future changes): CLI rewrite onto the v2 endpoints, deletion of v1 `POST /repos/:id/context` zip flow, markdown-extractor TS port for synthesis fingerprint filtering, idempotency on retried pushes, concurrent-push locking, failure recovery for stuck compendium jobs, verifier worker that re-applies CLI patches server-side, replay/rollback semantics, and branch-level events (timeline is `main`-only).

## Capabilities

### New Capabilities

- `project-events-store`: append-only `project_events` table, ULID identifiers, parent-id cascade chain, base domain event class, and the centralized `PersistEventHandler` that is the single writer.
- `dossier-pipeline`: per-repository `Dossier` aggregate root, `POST /v2/repos/:id/dossier/events` CLI push contract, scope-level event types (patch/regen/delete) with `Computed`/`Applied`/`Described` triplets, repo-level `DossierUpdateFired` and `DossierUpdated` roll-up, and the `dossier_pages` materialized view.
- `compendium-pipeline`: per-project `Compendium` aggregate root, `DossierUpdated` → bundle upload → queue publish cascade, `backend/synthesis` worker compendium-event dispatch branch, `POST /v2/internal/compendium/callback` with JWT auth, compendium event types (`RegenFired` / `PatchComputed` / `RegenApplied` / `Described` / `Updated`), and the `compendium_pages` materialized view.
- `project-events-timeline`: read APIs over `project_events` — org/project/repo linear feeds with `since`, `limit`, `types` filters, and single-event drill-down endpoint that returns the event plus its children via `parent_id`.

### Modified Capabilities

None. The v2 namespace is fully additive; no existing v1 controller, entity, migration, or spec is altered.

## Impact

- **Code**: new directory tree under `applications/backend/api/src/v2/` (entities, event-store, dossier, compendium, events-feed modules); new TypeORM migration adding three tables; dispatcher branch added in `applications/backend/synthesis/src/`.
- **Dependencies**: `@nestjs/cqrs` added to `applications/backend/package.json`.
- **Database**: three new tables (`project_events`, `dossier_pages`, `compendium_pages`) with their indexes and foreign keys; no schema changes to existing tables.
- **Infrastructure**: existing `StorageService` (Azure Blob) reused for compendium-job bundles under a new `<orgSlug>/compendium-jobs/` prefix; existing `QueueService` (NATS dev / ServiceBus prod) reused on the same `synthesis-jobs` queue with a new `type` discriminator.
- **Auth**: existing `FabrickAuthGuard` (JWT Bearer) for the CLI push endpoint; new short-lived callback JWT scope (`compendium-callback`) for the worker → API HTTP signal.
- **LLM cost**: compendium worker uses `@anthropic-ai/sdk` direct with `Project.anthropicApiKey` and `cache_control` breakpoints; no Claude Code subscription cache available on the server side (ADR D12 mitigated by prompt cache).
- **Analytics**: token usage rows continue to be written via the existing `TokenUsageRepository`.
- **CLI**: no changes in this proposal; CLI rebuild is a separate change.
- **Frontend**: new endpoints unlock a timeline UI that filters `type LIKE '%Updated'` for the main feed and drills into per-scope `Described` events for detail.
