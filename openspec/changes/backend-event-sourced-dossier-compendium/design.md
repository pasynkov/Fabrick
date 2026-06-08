## Context

The Fabrick incremental documentation pipeline is fully prototyped in `applications/incremental-lab/` (see ADR-001) and validated on the Nami test repo: per-PR wiki patch costs $0.10–$0.30, cross-repo synthesis stays within $0.85 per push when dynamic-threshold regen is used, and a JSONL patch log already records every change locally. The next step is moving that pipeline onto the product backend so the timeline becomes a first-class product surface (UI feed of "what changed and why" across all repos in a project) and the synthesized compendium is hosted authoritatively instead of being a CLI-side artifact.

The current backend (`applications/backend/api/`, NestJS + TypeORM + PostgreSQL) ingests CLI uploads as opaque zips via `POST /v1/repos/:id/context`, stores raw wiki files on Azure Blob, and runs a separate `applications/backend/synthesis/` worker that produces project-level `WikiPage` rows. There is no per-event history, no per-repo materialized state in PostgreSQL, and no concept of dossiers or compendiums distinct from each other. The API itself runs inside an Azure Function, so it cannot host a long-lived NATS/ServiceBus subscriber.

This design takes the lab pipeline and the existing backend shape and bridges them with an event-sourced v2 namespace that is fully additive — v1 endpoints, entities, migrations, and the existing zip flow stay untouched. CLI migration to v2 and removal of v1 zip ingestion are tracked as separate future changes.

## Goals / Non-Goals

**Goals:**

- Record every dossier and compendium lifecycle transition as an immutable event in a single `project_events` table that is the single timeline source.
- Materialize per-repo dossier and per-project compendium state in dedicated tables so the read side is fast and shape-stable.
- Drive compendium synthesis asynchronously through the existing worker, without requiring the API to subscribe to a queue (Azure Function constraint).
- Preserve the lab pipeline's two-phase compute/apply model, its haiku per-scope description (ADR D16), and its 4-page dossier / 4-topic compendium taxonomies (ADR D4, D8) intact.
- Adopt a uniform event lifecycle naming convention (`Fired` / `Computed` / `Applied` / `Described` / `Updated`) so the frontend can render a linear timeline by filtering one suffix.
- Centralize event persistence so business handlers never write directly to `project_events`.
- Stay side-by-side with v1; do not break the existing CLI push / console UI / synthesis worker contract.

**Non-Goals:**

- Rewriting the CLI onto v2 endpoints. This proposal only delivers the backend contract; CLI work is a separate change.
- Removing `POST /v1/repos/:id/context`. The zip flow stays until the CLI is migrated.
- Replay / rollback. The git working tree is the source of truth; merging branches is reconciled by running `fabrick regen` on the merged HEAD, not by replaying events.
- Idempotency on retried pushes. The CLI is trusted to push once per `(repo, headSha)` pair; duplicates are accepted.
- Concurrent-push locking. Two simultaneous pushes against the same repo are accepted; the latest writer wins on `dossier_pages`, both push event chains stay in the timeline.
- Failure recovery for a stuck compendium job (worker crash mid-processing). The `CompendiumRegenFired` event will simply sit without a paired `CompendiumUpdated`; a future change will add a recovery worker.
- Verifier worker that re-applies CLI-submitted patches server-side and flags divergence. Trust is one-way (backend believes CLI) in this change.
- Porting the lab's markdown extractor (`src/extract/markdown.js`) to TypeScript on the worker. The first version sends raw dossier bodies to the worker; the fingerprint-filter optimization (ADR D11) is deferred.
- Branch-level events. The timeline is `main`-only; CLI runs against branches keep working but do not push events.

## Decisions

### E1. Event-sourced backend storage in a single `project_events` table

Every domain event maps to one row in `project_events`. The table holds `id` (ULID, char(26)), `org_id` / `project_id` / `repo_id` (uuid FKs with cascade delete), `scope` (text, nullable for repo/system-level events), `type` (text discriminator), `parent_id` (char(26), nullable, cascade chain), `base_sha` / `head_sha` (text, nullable), `title` (text, nullable), `bodies` (jsonb, slug → markdown body, nullable), `instructions` (text, nullable — used by `*PatchComputed` events to store the raw patch.md), `meta` (jsonb — model, cost, token counts, sources[], slugCounts, sample, mode, reason), `pr_number` (int, nullable), and `at` (timestamptz default now). Indexes target the four query patterns the frontend needs: linear org feed, linear project feed, linear repo feed, drill-down by parent_id, and filtered-by-type queries.

**Alternative considered**: split per-aggregate event tables (`dossier_events` + `compendium_events`). Rejected because the timeline is fundamentally cross-aggregate (CompendiumRegenFired's `parent_id` points at a DossierUpdated row) and joining across two tables on `parent_id` is painful. A single table with indexed `type` and `parent_id` covers every read pattern with one query.

**Alternative considered**: column-per-attribute (e.g., separate `cost_usd`, `model`, `slugs` columns). Rejected because event types have heterogeneous payloads (`DossierPatchComputed` cares about `instructions` and `changedSlugs`, `CompendiumRegenApplied` cares about 4 bodies) and forcing them into a wide table produces a sparse schema. jsonb keeps the row small and lets the schema evolve.

### E2. Aggregate roots `Dossier` (per repository) and `Compendium` (per project)

Both classes extend NestJS CQRS `AggregateRoot`. `Dossier.applyPushUpdate(payload)` consumes a single CLI push DTO and emits the full scope-level event chain in order (`DossierUpdateFired` → per-scope `PatchComputed`/`PatchApplied`/`PatchDescribed` triplets, `RegenApplied`/`RegenDescribed` pairs, or `ScopeRemoved` singletons → `DossierUpdated`). `Compendium.fireRegen(dossierUpdatedId, bundleRef)` and `Compendium.acceptResult(resultBundle)` are the two entry points for the cascade; the first emits `CompendiumRegenFired`, the second emits the four compendium events in order. `Project` stays as a plain TypeORM entity; it does not emit events and is not an aggregate root.

**Alternative considered**: model every scope as its own AR. Rejected because the consistency boundary that matters is "one CLI push, atomic" — that is the dossier boundary. A push touching 11 scopes is one transaction, not 11.

**Alternative considered**: skip AggregateRoot entirely and emit events imperatively from command handlers. Rejected because the AR base class gives us `apply()` + `commit()` machinery that batches all emits into a single `EventBus.publishAll` call, which keeps the centralized persister atomic.

### E3. Centralized `PersistEventHandler` is the single writer of `project_events`

A single `@EventsHandler(DossierUpdateFired, DossierPatchComputed, …, CompendiumUpdated)` class subscribes to every concrete domain event type and maps each event to a `project_events` row via the abstract `BaseDomainEvent.toEntity()` contract. Business handlers (`DossierUpdatedHandler`, `ProcessCompendiumResultHandler`, etc.) never touch the events table directly — they only emit domain events through the aggregate root.

**Alternative considered**: every command handler writes to `project_events` itself. Rejected because it scatters the persistence logic, duplicates the type-to-column mapping, and makes it easy to forget a row when adding a new event type. A single sink with a type-checked decorator list keeps additions to "create the event class, add it to the decorator list".

### E4. Cascade compendium regeneration via `EventBus` listener on `DossierUpdated`

A `DossierUpdatedHandler` (NestJS `@EventsHandler(DossierUpdated)`) runs in the same HTTP request as the CLI push. It (a) assembles the input bundle from `compendium_pages` (current state) and `dossier_pages` (current state across all repos in the project), (b) computes `sha256(bundle)` and uploads to Azure Blob at `<orgSlug>/compendium-jobs/<dossierUpdatedId>-<hash>.json`, (c) instantiates the `Compendium` aggregate and calls `fireRegen` (which emits `CompendiumRegenFired` — persisted by E3), (d) signs a short-lived `callbackToken` JWT (`sub=dossierUpdatedId`, `scope=compendium-callback`, 1h expiry), and (e) publishes a `synthesis-jobs` queue message with `type: 'compendium-event'`, the bundle ref, the callback token, and the project's resolved Anthropic API key.

**Alternative considered**: do the bundle upload + queue publish inside the `PushDossierUpdate` command handler directly. Rejected because that couples the dossier write path to the compendium cascade — if we later add another cascade (notifications, alerts, search indexing), they'd accrete in the same handler. EventBus subscribers on a stable domain event give us a clean extension point.

**Alternative considered**: emit `CompendiumRegenFired` synchronously inside `applyPushUpdate` from the Dossier AR. Rejected because the AR boundary should not know about Azure Blob, queues, or JWTs — those are infrastructure concerns the cascade handler owns.

### E5. Worker is stateless, talks to the API only via HTTP + JWT, with bundles via Azure Blob

The API is hosted inside an Azure Function, so it cannot host a long-lived NATS or ServiceBus subscriber. The control plane between worker and API is therefore HTTP-only, even though job dispatch goes through the queue. Worker reads the job message (which carries the input bundle ref + callback token + Anthropic key), downloads the input bundle, runs sonnet patch compute + sonnet regen compute + haiku description, uploads the result bundle to `<orgSlug>/compendium-jobs/<dossierUpdatedId>-<hash>.result.json`, and HTTP-POSTs `/v2/internal/compendium/callback` with `Authorization: Bearer <callbackToken>` and a minimal body containing `{ jobId, resultBundleRef: { container, key, hash } }`. The API verifies the JWT, downloads the result bundle, persists the four compendium events through the `Compendium` AR + EventBus, upserts `compendium_pages`, and deletes both bundles from Azure Blob.

**Alternative considered**: have the API consume a `compendium-event-done` queue message instead of receiving an HTTP callback. Rejected because the Azure Function has no place to host a long-running subscriber and we'd have to introduce a separate non-Function deployable just for that subscription.

**Alternative considered**: pass the entire bundle inside the queue message. Rejected because NATS and ServiceBus both have message-size caps (default 1 MB on NATS, 256 KB on ServiceBus default tier) and a real multi-repo compendium bundle can hit hundreds of KB; bucket I/O removes the cap.

**Alternative considered**: pass the entire result bundle in the HTTP callback body. Rejected for the same size-cap reason and because keeping input and output symmetrical (both in the bucket) makes the cleanup logic — delete both blobs in one operation after `CompendiumUpdated` — trivial.

### E6. Trust model — backend stores what the CLI sent; the CLI is the compute authority

The CLI runs both phases (compute + apply, ADR D5) locally inside Claude Code's warm-cache subscription session and ships final bodies plus a CLI-haiku-derived title to the backend. The backend persists the result without independently re-running compute or apply. A future verifier worker (out of scope here) can re-apply `instructions` server-side against `bodies` snapshots and flag divergence, but we are not adding that machinery now.

**Alternative considered**: have the backend re-run apply (haiku) to derive bodies independently. Rejected because (a) it doubles LLM cost, (b) the backend loses the Claude Code subscription cost model, and (c) the CLI already has to apply locally to keep `.fabrick/wiki/` in sync for the next push — making the backend redo the same work just to be authoritative was strictly worse in cost without buying meaningful safety.

### E7. No replay, no rollback, no idempotency, no concurrent locking, no failure recovery — all deferred

The git working tree is the source of truth. Merging a branch into `main` is reconciled by running `fabrick regen` on the merged HEAD, which produces a fresh `DossierUpdated` chain — no replay of branch events. Retried pushes that result in duplicate event chains are accepted (CLI is expected to push once per `(repo, headSha)`; duplicates are visible in the timeline but cheap to filter on the read side). A `CompendiumRegenFired` without a paired `CompendiumUpdated` (worker crash) is left dangling; the bundles in the bucket stay until a future janitor job removes them. These are all explicit deferrals so the v1 of this feature stays small and the patterns can be revisited once we have production traffic shape.

### E8. Synthesis stays regen-only; `CompendiumPatchComputed` is captured as a shadow audit artifact

The worker runs both a sonnet patch-compute pass (producing patch.md instructions) and a sonnet regen-compute pass (producing fresh 4 topic bodies). The regen output is the truth used to upsert `compendium_pages` and to ship to the CLI. The patch instructions are persisted in `CompendiumPatchComputed.instructions` as a per-run shadow audit so that, later, when the markdown extractor TS port (D11) lands, we can switch the compendium pipeline to patch-truth with regen-shadow and measure the drift without changing the storage shape. There is no automated quality comparison in this change.

### E9. Event lifecycle naming convention — `Fired` / `Computed` / `Applied` / `Described` / `Updated`

Every event type ends with one of five suffixes that mark its position in the lifecycle: `Fired` (phase kickoff marker), `Computed` (LLM produced raw output), `Applied` (persistent state updated), `Described` (haiku-extracted human title), `Updated` (phase finalized, top-level timeline entry). The frontend filters `type LIKE '%Updated'` to render the main linear timeline. Drill-down into a row joins on `parent_id` to fetch children. `*Described` events are the per-scope detail rows surfacing the haiku titles for granular views.

### E10. `*Updated` title inheritance

The repo-level `DossierUpdated.title` is populated from the CLI-provided PR/git subject (ADR D15). The system-level `CompendiumUpdated.title` is inherited verbatim from the preceding `CompendiumDescribed.title` at write time (the same handler that emits `CompendiumUpdated` reads the just-emitted `CompendiumDescribed`'s title and copies it). Per-scope events keep their own titles. No query-time joins for title rendering.

### E11. Frontmatter — CLI ships markdown with frontmatter inline; backend stores raw

ADR D9 mandates that the LLM never sees or writes frontmatter; the CLI stamps it deterministically before shipping. We honor that: the `bodies` jsonb values in events and the `content` text in `dossier_pages` / `compendium_pages` contain the markdown body with the frontmatter block at the top, exactly as the CLI produced it. A parallel `frontmatter jsonb` column on `dossier_pages` and `compendium_pages` holds the parsed YAML for search and filter queries; backend parses content on insert/update and writes the parsed map.

### E12. CLI is the only haiku caller for dossier titles; worker is the only haiku caller for compendium titles

`DossierPatchDescribed` and `DossierRegenDescribed` carry titles computed by the CLI inside the warm Claude Code session (ADR D16 compliant, ~$0.002 per scope). The backend never re-runs haiku for dossier-level descriptions. The worker runs haiku for `CompendiumDescribed` because the title needs cross-repo diff awareness which the CLI does not have. Anthropic prompt-cache breakpoints are attached to the worker's sonnet and haiku system prompts (cost mitigation per ADR D12).

### E13. v2 namespace is fully additive; v1 contract is frozen for this change

All new entities, controllers, services, modules, and migrations live under `applications/backend/api/src/v2/` (and a corresponding new dispatcher branch in `applications/backend/synthesis/`). No v1 file is edited. The two flows coexist on the same database and the same queue; v1 keeps writing to `WikiPage` and Azure Blob via the zip flow, v2 writes to the three new tables and the new bucket prefix.

## Risks / Trade-offs

- **CLI bug pollutes the timeline** → Mitigation: the timeline is append-only and the events are typed; a verifier worker (future) can detect inconsistent push chains by comparing emitted body shas against the next push's baseline. For now the assumption is that bad pushes are rare and cheap to inspect.
- **`CompendiumRegenFired` without a paired `CompendiumUpdated` (worker crash, network error)** → No mitigation in this change. UI surfaces a "regen in progress" indicator that may stick until manual intervention; a future janitor + recovery worker change will reconcile.
- **Backend LLM cost is higher than the lab numbers because no Claude Code subscription cache** → Mitigation: `cache_control` breakpoints on the worker's system prompts (Anthropic prompt cache, 5-min TTL) keep within-window costs low; document expected 1.5–2× the lab synthesis cost for cold-start runs.
- **Concurrent pushes against the same repo race on `dossier_pages` upsert** → Acceptable. Both event chains live in the timeline; the materialized row reflects whichever transaction commits last. PG row-level locking inside one transaction prevents corruption; cross-transaction ordering is "latest writer wins".
- **Result bundle JSON grows unbounded with very large projects (50+ repos × many scopes)** → Soft limit. Azure Blob has no practical size cap; the worker memory budget might become the limiting factor. Out of scope to mitigate now; we will measure and react.
- **`project_events` table grows monotonically** → Acceptable for v1. A future change will add partitioning by month or a cold-storage archive policy. PG with jsonb handles tens of millions of rows comfortably with the right indexes.
- **Single-table event store is harder to evolve schema for** → Mitigation: every payload field lives in `bodies` or `meta` (jsonb) — only `type`, `parent_id`, and the FK columns are first-class. Adding a new event type does not require a migration.
- **CompendiumPatchComputed shadow cost is wasted until the markdown extractor lands** → Acceptable. Per-run shadow cost is ~$0.05 sonnet; we deliberately pay it to bank the audit history so the future patch-quality work has data to compare against.

## Migration Plan

1. Add `@nestjs/cqrs` to `applications/backend/package.json`.
2. Scaffold the `applications/backend/api/src/v2/` directory tree with all modules empty and registered in `AppModule`.
3. Add the TypeORM migration that creates `project_events`, `dossier_pages`, `compendium_pages`. Migration runs on next API deploy (existing `migrationsRun: true` config).
4. Implement entities, base domain event class, concrete event classes, `EventStoreService`, and `PersistEventHandler`.
5. Implement `Dossier` AR + `PushDossierUpdateCommand` + handler + `DossierController` + DTOs.
6. Implement `Compendium` AR + `DossierUpdatedHandler` + `CompendiumBundleService` + JWT issue/verify service.
7. Implement `ProcessCompendiumResultCommand` + handler + `CompendiumInternalController`.
8. Implement `EventsFeedController` + queries.
9. Implement `DossierController.getDossier` and `CompendiumController.getCompendium` read endpoints.
10. Modify `applications/backend/synthesis/src/synthesis/synthesis.service.ts` (or its consumer entry point) to dispatch by `msg.type` and branch into the new compendium-event handler.
11. Implement the compendium-event handler in the worker (download bundle, run sonnet+sonnet+haiku with `cache_control`, upload result, HTTP callback).
12. Add e2e tests covering the CLI push happy path, a worker callback happy path, and the linear timeline feed.
13. Deploy API first (migration applies on boot), then worker. The two flows coexist with v1; existing CLI/console traffic is unaffected.

Rollback: revert the deploy. The new tables are independent of v1 entities; leaving them in place after a revert is harmless. If the new tables must be torn down, drop them and revert the migration — no v1 data depends on them.

## Open Questions

- **Should `dossier_pages.frontmatter` and `compendium_pages.frontmatter` be derived columns or stored separately?** Current decision: stored separately (parsed on insert/update) for query simplicity. Revisit if the parse becomes expensive.
- **What is the right `cache_control` granularity on the worker?** Likely the static system prompt is one breakpoint and the per-job input bundle is another. Empirical tuning needed once the worker runs against real load.
- **Should `CompendiumPatchComputed.instructions` length be capped?** A pathological project might produce a multi-thousand-line patch.md. For v1 we accept whatever the sonnet call returns; a cap can be added later if observed sizes hurt.
