## 1. Setup and Scaffolding

- [ ] 1.1 Add `@nestjs/cqrs` to `applications/backend/package.json` dependencies and install
- [ ] 1.2 Create directory tree `applications/backend/api/src/v2/{event-store,dossier,compendium,events-feed,entities}` with empty `index.ts` placeholders
- [ ] 1.3 Create `v2.module.ts` that imports `CqrsModule` and registers all child v2 modules; wire it into `AppModule`

## 2. TypeORM Entities and Migration

- [ ] 2.1 Create `applications/backend/api/src/v2/entities/project-event.entity.ts` matching the `project_events` schema in `project-events-store/spec.md`
- [ ] 2.2 Create `applications/backend/api/src/v2/entities/dossier-page.entity.ts` matching the schema in `dossier-pipeline/spec.md`
- [ ] 2.3 Create `applications/backend/api/src/v2/entities/compendium-page.entity.ts` matching the schema in `compendium-pipeline/spec.md`
- [ ] 2.4 Add the three entities to the `entities: [...]` list in `AppModule`'s TypeORM config
- [ ] 2.5 Create migration `applications/backend/api/src/migrations/<ts>-AddV2EventTables.ts` that creates `project_events`, `dossier_pages`, `compendium_pages` with all indexes and foreign keys
- [ ] 2.6 Register the migration in `applications/backend/api/src/migrations/index.ts`
- [ ] 2.7 Run the migration locally against the dev DB and confirm the three tables exist with the expected schema

## 3. Event Store and Base Domain Event

- [ ] 3.1 Implement `applications/backend/api/src/v2/event-store/domain/base-domain-event.ts` abstract class with the fields and `toEntity()` contract from `project-events-store/spec.md`
- [ ] 3.2 Implement `applications/backend/api/src/v2/event-store/ulid.service.ts` providing a `generate()` method using a ULID library (add `ulid` to dependencies)
- [ ] 3.3 Implement `applications/backend/api/src/v2/event-store/event-store.service.ts` with `persist(entity: ProjectEvent)` saving via the TypeORM repository
- [ ] 3.4 Implement `applications/backend/api/src/v2/event-store/handlers/persist-event.handler.ts` as `@EventsHandler` decorated with the placeholder array (filled in step 6.5 after all event classes exist) calling `eventStore.persist(event.toEntity())`
- [ ] 3.5 Create `event-store.module.ts` exporting `EventStoreService`, `UlidService`, and registering `PersistEventHandler` as a provider

## 4. Dossier Event Classes

- [ ] 4.1 Implement `applications/backend/api/src/v2/dossier/events/dossier-update-fired.event.ts` extending `BaseDomainEvent`
- [ ] 4.2 Implement `dossier-patch-computed.event.ts`
- [ ] 4.3 Implement `dossier-patch-applied.event.ts`
- [ ] 4.4 Implement `dossier-patch-described.event.ts`
- [ ] 4.5 Implement `dossier-regen-applied.event.ts`
- [ ] 4.6 Implement `dossier-regen-described.event.ts`
- [ ] 4.7 Implement `dossier-scope-removed.event.ts`
- [ ] 4.8 Implement `dossier-updated.event.ts`
- [ ] 4.9 Verify every event's `type` getter returns its class name verbatim and `toEntity()` populates `project_events` columns 1-to-1

## 5. Dossier Aggregate Root and Push Command

- [ ] 5.1 Implement `applications/backend/api/src/v2/dossier/dossier.aggregate.ts` extending `AggregateRoot` with `applyPushUpdate(payload)` emitting events per `dossier-pipeline/spec.md` Requirement: Dossier aggregate root
- [ ] 5.2 Implement DTO classes `push-dossier-update.dto.ts` (request body validation via `class-validator`, including the `scopes[].mode` discriminated union)
- [ ] 5.3 Implement `commands/push-dossier-update.command.ts` and `push-dossier-update.handler.ts` that loads `Repository`, authorizes the user, instantiates `Dossier`, calls `applyPushUpdate`, and returns `{ dossierUpdatedId }`
- [ ] 5.4 Implement `dossier.controller.ts` exposing `POST /v2/repos/:repoId/dossier/events` and `GET /v2/repos/:repoId/dossier`, both behind `FabrickAuthGuard`
- [ ] 5.5 Implement `services/dossier-pages.repository.ts` providing `upsertChanged(scope, slug → body)`, `upsertAll(scope, bodies)`, and `deleteScope(scope)` methods that the EventBus handlers (next section) will call
- [ ] 5.6 Implement an `@EventsHandler(DossierPatchApplied, DossierRegenApplied)` that upserts `dossier_pages` rows after the events are emitted
- [ ] 5.7 Implement an `@EventsHandler(DossierScopeRemoved)` that deletes `dossier_pages` rows for the removed scope
- [ ] 5.8 Implement frontmatter YAML parser used by the upsert paths to populate the `frontmatter` jsonb column from the inline-frontmatter `content`
- [ ] 5.9 Create `dossier.module.ts` registering controllers, command handler, event handlers, repository, and importing `EventStoreModule` and `CqrsModule`

## 6. Compendium Event Classes and Aggregate

- [ ] 6.1 Implement `compendium-regen-fired.event.ts`, `compendium-patch-computed.event.ts`, `compendium-regen-applied.event.ts`, `compendium-described.event.ts`, `compendium-updated.event.ts`
- [ ] 6.2 Implement `compendium.aggregate.ts` extending `AggregateRoot` with `fireRegen(...)` and `acceptResult(...)` per `compendium-pipeline/spec.md`
- [ ] 6.3 Implement `services/compendium-jwt.service.ts` issuing and verifying callback tokens using the existing `JwtService` with scope `compendium-callback`
- [ ] 6.4 Implement `services/compendium-bundle.service.ts` with `assembleInput(projectId, dossierUpdatedId)`, `upload(orgSlug, id, bundle): {ref, hash}`, `download(ref): bundle`, `uploadResult(...)`, `deleteBoth(inputRef, resultRef)` using `StorageService`
- [ ] 6.5 Add every domain event class to `PersistEventHandler`'s `@EventsHandler(...)` decorator argument list

## 7. DossierUpdated Cascade and Worker Dispatch

- [ ] 7.1 Implement `handlers/dossier-updated.handler.ts` as `@EventsHandler(DossierUpdated)` performing the seven steps in `compendium-pipeline/spec.md` Requirement: DossierUpdated cascade handler
- [ ] 7.2 Ensure the handler uses `ApiKeyResolutionService` for the Anthropic key and `ApiKeyAuditService` for the audit log entry
- [ ] 7.3 Confirm the handler uses the existing `QueueService.publish('synthesis-jobs', { type: 'compendium-event', ... })` API

## 8. Compendium Callback and Materialized View Write

- [ ] 8.1 Implement DTO classes for the callback body (`jobId`, `resultBundleRef`)
- [ ] 8.2 Implement `commands/process-compendium-result.command.ts` and `process-compendium-result.handler.ts` per `compendium-pipeline/spec.md` Requirement: Compendium internal callback endpoint
- [ ] 8.3 Implement `services/compendium-pages.repository.ts` with `upsertAll(projectId, pages)` writing the four topic rows transactionally
- [ ] 8.4 Implement `compendium-internal.controller.ts` exposing `POST /v2/internal/compendium/callback` that verifies the JWT, downloads the result bundle, dispatches the command, and returns 200
- [ ] 8.5 Implement `compendium.controller.ts` exposing `GET /v2/projects/:projectId/compendium` returning the four topic rows
- [ ] 8.6 Implement an `@EventsHandler(CompendiumRegenApplied)` (or the post-command handler step) that upserts `compendium_pages` from the `finalCompendium.pages` payload
- [ ] 8.7 Register the bundle-cleanup step (delete input + result blobs) at the end of the command handler so it runs after `CompendiumUpdated` is committed
- [ ] 8.8 Create `compendium.module.ts` registering both controllers, the cascade handler, the callback command handler, all services, and importing dependencies

## 9. Timeline Read Endpoints

- [ ] 9.1 Implement `events-feed/queries/list-project-events.query.ts` and handler with `since` cursor, `limit`, and `types` glob filter; build the SQL via TypeORM query builder using the indexes from the entity definition
- [ ] 9.2 Implement `events-feed/queries/get-project-event-with-children.query.ts` and handler
- [ ] 9.3 Implement `services/event-type-matcher.ts` translating one or more `*`-wildcard glob patterns into a PostgreSQL `LIKE`/`ILIKE` clause
- [ ] 9.4 Implement `events-feed.controller.ts` exposing the four endpoints: `GET /v2/orgs/:orgId/events`, `GET /v2/projects/:projectId/events`, `GET /v2/repos/:repoId/events`, `GET /v2/repos/:repoId/events/:eventId`
- [ ] 9.5 All endpoints behind `FabrickAuthGuard` with org-member authorization per `project-events-timeline/spec.md`
- [ ] 9.6 Implement `ProjectEventDto` mapper that copies row fields to the response shape

## 10. Worker Modifications (applications/backend/synthesis)

- [ ] 10.1 In the worker's queue consumer entry point, add a dispatcher: `if (msg.type === 'compendium-event') return handleCompendiumEvent(msg)` else fall through to existing v1 synthesis logic
- [ ] 10.2 Implement `compendium-event.handler.ts` performing the eight steps in `compendium-pipeline/spec.md` Requirement: Compendium worker dispatch
- [ ] 10.3 Implement Azure Blob download with sha256 verification; abort cleanly without callback on mismatch
- [ ] 10.4 Implement the sonnet patch-compute call using `@anthropic-ai/sdk` with `cache_control` breakpoints on the stable system prompt portion
- [ ] 10.5 Implement the sonnet regen-compute call producing the four topic bodies with frontmatter stamped inline
- [ ] 10.6 Implement the haiku description call producing the one-sentence title from the diff of old vs new topic bodies
- [ ] 10.7 Implement the result bundle upload to `<orgSlug>/compendium-jobs/<id>-<hash>.result.json`
- [ ] 10.8 Implement the HTTP POST callback to `/v2/internal/compendium/callback` with `Authorization: Bearer <callbackToken>` and the result bundle ref
- [ ] 10.9 Wire token usage recording for each LLM call via the worker-side analytics path that matches existing v1 patterns

## 11. End-to-End Tests

- [ ] 11.1 Add an e2e test (`api/test/v2-dossier-push.e2e-spec.ts`) that POSTs a multi-scope push DTO and asserts the full event chain is persisted to `project_events` and `dossier_pages` reflects the applied bodies
- [ ] 11.2 Add an e2e test that simulates a worker callback (POST `/v2/internal/compendium/callback` with a signed JWT and a pre-staged result blob) and asserts the four compendium events are persisted, `compendium_pages` is upserted, and both bundles are deleted
- [ ] 11.3 Add an e2e test for the timeline feed: post a push, then GET `/v2/repos/:id/events?types=*Updated` and assert exactly the `DossierUpdated` row is returned
- [ ] 11.4 Add an e2e test for the drill-down endpoint: GET a single `DossierUpdated` event id and assert the response includes all per-scope children

## 12. Validation and Hand-off

- [ ] 12.1 Run `openspec validate backend-event-sourced-dossier-compendium --strict` and fix any reported issues
- [ ] 12.2 Run `npm run build` inside `applications/backend/` and confirm the v2 namespace type-checks cleanly with no v1 regressions
- [ ] 12.3 Smoke-test locally: stand up postgres + minio + nats via the existing `docker-compose.yml`, POST a sample dossier push from `curl`, observe the queue message, run the worker locally, verify `compendium_pages` populates and bundles are cleaned
- [ ] 12.4 Confirm no v1 endpoint, controller, entity, migration, or service file has been modified by this change
