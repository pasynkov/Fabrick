## ADDED Requirements

### Requirement: Compendium aggregate root

The system SHALL define a `Compendium` class that extends the NestJS CQRS `AggregateRoot` and represents the cross-repository synthesized state of one project. The aggregate root SHALL expose two methods:

- `fireRegen(dossierUpdatedId: string, bundleRef: { container, key, hash }, repos: string[])` — emits exactly one `CompendiumRegenFired` event with `parent_id` set to `dossierUpdatedId`.
- `acceptResult(jobId: string, result: CompendiumResultBundle)` — emits, in order: `CompendiumPatchComputed` (parent = jobId), `CompendiumRegenApplied` (parent = jobId), `CompendiumDescribed` (parent = jobId), `CompendiumUpdated` (parent = the just-emitted `CompendiumDescribed` id). `CompendiumUpdated.title` SHALL be copied verbatim from `CompendiumDescribed.title`.

#### Scenario: Cascade kickoff

- **WHEN** `fireRegen` is called
- **THEN** exactly one `CompendiumRegenFired` event is emitted with `parent_id` set to the supplied `dossierUpdatedId`

#### Scenario: Worker result processing

- **WHEN** `acceptResult` is called with a well-formed bundle
- **THEN** four events are emitted in the order `CompendiumPatchComputed`, `CompendiumRegenApplied`, `CompendiumDescribed`, `CompendiumUpdated`
- **AND** the first three share `parent_id = jobId`
- **AND** `CompendiumUpdated.parent_id` equals the just-emitted `CompendiumDescribed.id`
- **AND** `CompendiumUpdated.title` is equal to `CompendiumDescribed.title`

### Requirement: DossierUpdated cascade handler

The system SHALL register a `DossierUpdatedHandler` as a NestJS CQRS `@EventsHandler(DossierUpdated)` that runs in the same HTTP request as the originating CLI push. The handler SHALL:

1. Build the input bundle for the compendium worker, containing `{ projectId, dossierUpdatedId, currentCompendium, currentDossiers, projectMeta }` where `currentCompendium` is the current `compendium_pages` snapshot (or `null` if empty), `currentDossiers` is the full `dossier_pages` snapshot for every repo in the project keyed by repo slug, and `projectMeta` is `{ repos: [{ id, slug, name }] }`.
2. Compute `hash = sha256(canonical JSON serialization of bundle)`.
3. Upload the bundle to Azure Blob at container `<orgSlug>`, key `compendium-jobs/<dossierUpdatedId>-<hash>.json` using the existing `StorageService`.
4. Resolve the project's Anthropic API key via the existing `ApiKeyResolutionService` and log the use via `ApiKeyAuditService`.
5. Sign a `callbackToken` JWT with `{ sub: dossierUpdatedId, scope: 'compendium-callback' }` and a 1-hour expiry using the existing `JwtService`.
6. Instantiate `Compendium(projectId)`, merge the EventBus publisher context, call `fireRegen(dossierUpdatedId, bundleRef, repos)`, and commit. (`CompendiumRegenFired` is persisted by `PersistEventHandler`; its `meta` carries the `bundleRef`.)
7. Publish a `synthesis-jobs` queue message via the existing `QueueService` with body `{ type: 'compendium-event', jobId: dossierUpdatedId, projectId, orgSlug, projectSlug, bundleRef: { container, key, hash }, anthropicApiKey, callbackToken }`.

#### Scenario: Cascade after dossier push

- **WHEN** a `DossierUpdated` event is published on the EventBus
- **THEN** the bundle is uploaded to Azure Blob
- **AND** a `CompendiumRegenFired` event is persisted in `project_events` with `parent_id` set to the `DossierUpdated.id`
- **AND** a `synthesis-jobs` queue message is published with `type: 'compendium-event'` and the bundle ref

#### Scenario: First push for empty project

- **WHEN** the project has no prior `compendium_pages` rows
- **THEN** the bundle's `currentCompendium` field is `null`
- **AND** the cascade still proceeds and queues a job

### Requirement: Compendium worker dispatch

The system SHALL modify the `applications/backend/synthesis/` worker so that its queue consumer dispatches by `msg.type`:

- When `msg.type === 'compendium-event'`, the new compendium-event handler SHALL run.
- When `msg.type` is undefined or any other value, the existing legacy v1 synthesis flow SHALL run unchanged.

The compendium-event handler SHALL:

1. Download the input bundle from Azure Blob using the bundle ref in the message.
2. Verify `sha256(downloaded bytes) === bundleRef.hash`. On mismatch, log and abort without callback.
3. Run a sonnet patch-compute LLM call producing the compendium patch.md instructions. The call SHALL use the `@anthropic-ai/sdk` client with `cache_control` breakpoints on the stable portion of the system prompt.
4. Run a sonnet regen-compute LLM call producing the four fresh compendium topic bodies (slugs `system`, `data-flows`, `transport-graph`, `infra`), each with frontmatter stamped inline.
5. Run a haiku description LLM call producing a one-sentence title (≤ 30 words) referencing concrete identifiers, computed from the diff between old and new compendium bodies.
6. Record token usage via the existing `TokenUsageRepository` with `operation = 'compendium'`.
7. Assemble the result bundle `{ jobId, patchComputed: { instructions, meta }, regenApplied: { bodies, meta }, described: { title, meta }, finalCompendium: { pages: [{ slug, title, content, sources[], related[] }] } }` and upload to Azure Blob at `<orgSlug>/compendium-jobs/<dossierUpdatedId>-<hash>.result.json`.
8. HTTP POST `/v2/internal/compendium/callback` on the API host with `Authorization: Bearer <callbackToken>` and body `{ jobId, resultBundleRef: { container, key, hash } }`.

#### Scenario: Successful compendium job

- **WHEN** a `compendium-event` job arrives at the worker with a valid bundle ref
- **THEN** the worker downloads the input, runs the three LLM calls, uploads the result, and POSTs the callback
- **AND** token usage is recorded for each LLM call

#### Scenario: Hash mismatch

- **WHEN** the downloaded input bundle's sha256 does not match the supplied hash
- **THEN** the worker aborts without making LLM calls and without posting the callback
- **AND** an error is logged with the job id

#### Scenario: Legacy synthesis message

- **WHEN** a message arrives on the queue with `type` undefined or with the legacy v1 shape
- **THEN** the worker runs the existing v1 synthesis flow unchanged

### Requirement: Compendium internal callback endpoint

The system SHALL expose `POST /v2/internal/compendium/callback` that accepts the worker's result signal. The endpoint SHALL:

1. Verify the `Authorization: Bearer <token>` header by decoding the JWT and checking `scope === 'compendium-callback'` and `sub === body.jobId`. Reject with 401 on mismatch.
2. Download the result bundle from Azure Blob using the supplied result bundle ref.
3. Dispatch a `ProcessCompendiumResultCommand` via the CommandBus with the bundle contents.
4. The command handler SHALL load the project, instantiate `Compendium(projectId)`, merge the EventBus publisher context, call `acceptResult(jobId, result)`, and commit. The four compendium events SHALL be persisted by `PersistEventHandler`.
5. The handler SHALL upsert `compendium_pages` rows for each topic in `finalCompendium.pages`.
6. The handler SHALL delete both the input bundle and the result bundle from Azure Blob.
7. Respond 200.

#### Scenario: Valid callback

- **WHEN** the worker POSTs a callback with a valid token and bundle ref
- **THEN** the four compendium events are persisted
- **AND** `compendium_pages` is upserted with the four topic bodies
- **AND** both bundles are deleted from Azure Blob

#### Scenario: Invalid JWT

- **WHEN** the callback is posted with a tampered or expired token
- **THEN** the response returns 401
- **AND** no events are persisted and no bundles are downloaded or deleted

#### Scenario: Bundle download failure

- **WHEN** the result bundle does not exist or cannot be downloaded
- **THEN** the endpoint returns 500
- **AND** no events are persisted

### Requirement: Per-project materialized view `compendium_pages`

The system SHALL maintain a `compendium_pages` table holding the current synthesized topic bodies for every project. The table SHALL contain:

- `id` uuid primary key
- `org_id` uuid NOT NULL FK cascade
- `project_id` uuid NOT NULL FK cascade
- `slug` text NOT NULL
- `title` text NOT NULL
- `content` text NOT NULL — markdown body including frontmatter inline
- `sources` text[] NOT NULL DEFAULT `'{}'`
- `related` text[] NOT NULL DEFAULT `'{}'`
- `frontmatter` jsonb NOT NULL DEFAULT `'{}'`
- `updated_at` timestamptz NOT NULL DEFAULT `now()`

The table SHALL have a unique index on `(project_id, slug)`.

#### Scenario: First compendium upsert creates four rows

- **WHEN** a project's first `CompendiumUpdated` is processed
- **THEN** four rows are inserted into `compendium_pages` for that project, one per topic slug

#### Scenario: Subsequent upsert replaces content

- **WHEN** a project already has compendium rows and a new `CompendiumUpdated` is processed
- **THEN** the four rows are updated in place with new `content`, `sources`, `related`, `frontmatter`, and `updated_at`

### Requirement: Compendium event types

The system SHALL define the following concrete domain event classes:

- `CompendiumRegenFired` — kickoff; `scope = null`, `bodies = null`, `instructions = null`; `meta` carries `{ bundleRef: { container, key, hash }, repos: string[], dossierUpdatedId }`
- `CompendiumPatchComputed` — shadow audit; `instructions` carries the sonnet patch.md; `bodies = null`; `meta` carries `{ model, inputTokens, outputTokens, costUsd }`
- `CompendiumRegenApplied` — truth; `bodies` carries the four topic bodies; `meta` carries `{ model, inputTokens, outputTokens, costUsd }`
- `CompendiumDescribed` — title; `title` set to the worker haiku output; `meta` carries `{ model, inputTokens, outputTokens, costUsd }`
- `CompendiumUpdated` — phase final; `title` inherited from `CompendiumDescribed`; `meta` carries `{ repos: string[], totalCostUsd }`

#### Scenario: Persisted event type

- **WHEN** any of these events is persisted
- **THEN** `project_events.type` contains the event class name verbatim

### Requirement: Compendium snapshot read endpoint

The system SHALL expose `GET /v2/projects/:projectId/compendium` protected by `FabrickAuthGuard`. The endpoint SHALL return the four topic rows in a stable order, with shape:

```
{
  pages: Array<{
    slug: string,
    title: string,
    content: string,
    sources: string[],
    related: string[],
    frontmatter: object,
    updatedAt: string
  }>
}
```

#### Scenario: Project without compendium

- **WHEN** an authenticated org member requests the compendium of a project that has not been synthesized yet
- **THEN** the response returns `{ pages: [] }`

#### Scenario: Project with compendium

- **WHEN** the project has four compendium rows
- **THEN** the response returns four entries in the order `system`, `data-flows`, `transport-graph`, `infra`

#### Scenario: Non-member access

- **WHEN** a non-member requests the endpoint
- **THEN** the response returns 404

### Requirement: Bundle cleanup on success

The system SHALL delete both the input and result bundles from Azure Blob once the `ProcessCompendiumResultCommand` has persisted `CompendiumUpdated` and upserted `compendium_pages`.

#### Scenario: Successful callback cleans both bundles

- **WHEN** the callback handler finishes upserting `compendium_pages`
- **THEN** both `<orgSlug>/compendium-jobs/<id>-<hash>.json` and `<orgSlug>/compendium-jobs/<id>-<hash>.result.json` are deleted

#### Scenario: Callback failure leaves bundles in place

- **WHEN** the callback handler raises before completing the cleanup step
- **THEN** the bundles remain in Azure Blob for later manual or automated inspection
