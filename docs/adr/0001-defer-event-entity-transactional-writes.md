# 0001 — Defer transactional wrap of event + entity writes

**Status:** Accepted (deferred)
**Date:** 2026-06-08

## Context

V2 command/event handlers persist domain events (`project_events`) and
projection rows (`dossier_pages`, `compendium_pages`) in the same handler
method, but **not in a single database transaction**. Concrete sites:

- `PushDossierUpdateHandler.execute()` — `eventStore.persistBatch()` followed
  by a loop of `dossierPagesRepo.upsertChanged() / deleteScope()`.
- `ProcessCompendiumResultHandler.execute()` — `persistBatch()` then
  `compendiumPagesRepo.upsertAll()` then `bundleService.deleteBoth()` (S3).
- `DossierUpdatedHandler.handle()` — after this change, persists
  `CompendiumRegenFired` then publishes to the synthesis queue.

A failure between writes leaves the system inconsistent: events without
projections, or vice versa. External side-effects (queue publish, S3 delete)
are not rollback-able regardless.

## Decision

**Do not** wrap event + entity writes in a database transaction yet.

Adopt a smaller change instead: a shared `AggregateRepository.persist(agg)`
helper that writes the aggregate's uncommitted domain events to
`project_events`. Handlers call `aggregateRepo.persist(agg)`, run any
projection upserts they need, then call `agg.commit()` to publish on the
EventBus. The order is unchanged; only the boilerplate is centralised. No
TypeORM transaction is opened.

## Why deferred

A correct transactional implementation needs all of:

1. `EntityManager`-aware variants of every projection repository method
   (`upsertChangedTx`, `upsertAllTx`, `deleteScopeTx`, ...). Today they
   inject their own `Repository<T>` and cannot share a `QueryRunner`.
2. Strict separation of slow IO (S3 bundle assembly, JWT signing, API-key
   resolution) from the transactional block. A long transaction would pin
   a connection from the pool for the duration of an external HTTP call.
3. An outbox or equivalent for external side-effects (`queueService.publish`,
   `storageService.deleteObject`). Committing the DB transaction and then
   failing the queue publish still leaves the system inconsistent unless
   the queue dispatch is itself driven from a durable record.
4. A test harness that can drive the new path end-to-end without flaking.

None of this is in scope for the current follow-up, which only fixes the
missing `CompendiumRegenFired` persist and removes a TRUNCATE-driven race
in the e2e suite.

## Consequences

- Partial-failure window remains: if the process crashes between
  `persistBatch()` and a downstream `upsert`, the two stores diverge.
- Mitigations relied on today: handler bodies are short, projection upserts
  are idempotent, queue publishes are idempotent on `jobId`, and the
  affected handlers run on the request thread (a crash kills the response
  with a visible 5xx rather than silently corrupting state).
- Re-open this ADR when we either (a) observe a real partial-failure
  incident, or (b) introduce a write path where the projections cannot be
  reconstructed from the event log alone.

## Alternatives considered

- **Wildcard `@EventsHandler(BaseDomainEvent)` subscriber that persists
  every event.** Rejected: NestJS CQRS `EventBus` is asynchronous, so the
  HTTP response would return before the persist completed and break
  read-after-write for the v2 timeline endpoints.
- **Override `AggregateRoot.commit()` in a `PersistentAggregateRoot`
  subclass.** Rejected: requires injecting `EventStoreService` into a pure
  domain object, breaking the aggregate's isolation from infrastructure.
- **Full outbox pattern now.** Rejected as premature: solves both the
  transactional and the external-side-effect problem at once, but the
  current write volume and failure profile do not justify the refactor.
