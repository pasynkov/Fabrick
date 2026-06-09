## ADDED Requirements

### Requirement: Dossier aggregate root

The system SHALL define a `Dossier` class that extends the NestJS CQRS `AggregateRoot` and represents the documentation state of one repository. The aggregate root SHALL expose an `applyPushUpdate(payload)` method that emits the full dossier event chain for a single CLI push as a sequence of domain events through `this.apply(...)` and commits them via `commit()`.

For a push payload carrying scope entries with `mode = 'patch' | 'regen' | 'delete'`, `applyPushUpdate` SHALL emit:

1. exactly one `DossierUpdateFired` event as the chain root (`parent_id = NULL`)
2. for each scope with `mode = 'patch'`: `DossierPatchComputed`, then `DossierPatchApplied`, then `DossierPatchDescribed` — all three with `parent_id` set to the `DossierUpdateFired` id
3. for each scope with `mode = 'regen'`: `DossierRegenApplied`, then `DossierRegenDescribed` — both with `parent_id` set to the `DossierUpdateFired` id
4. for each scope with `mode = 'delete'`: exactly one `DossierScopeRemoved` — with `parent_id` set to the `DossierUpdateFired` id
5. exactly one `DossierUpdated` event as the chain terminus — with `parent_id` set to the `DossierUpdateFired` id and `title` set to the CLI-provided PR/git subject

#### Scenario: Single-scope patch push

- **WHEN** the CLI pushes one scope with `mode = 'patch'`
- **THEN** the aggregate emits exactly five events in order: `DossierUpdateFired`, `DossierPatchComputed`, `DossierPatchApplied`, `DossierPatchDescribed`, `DossierUpdated`
- **AND** all four child events share the same `parent_id` equal to the `DossierUpdateFired` id

#### Scenario: Mixed-mode push

- **WHEN** the CLI pushes three scopes with modes `[patch, regen, delete]`
- **THEN** the aggregate emits eight events: `Fired`, 3 patch events, 2 regen events, 1 delete event, `Updated`
- **AND** every child event shares the `parent_id` of the single `DossierUpdateFired`

### Requirement: CLI push endpoint

The system SHALL expose `POST /v2/repos/:repoId/dossier/events` protected by the existing `FabrickAuthGuard` (JWT Bearer). The endpoint SHALL accept a batch DTO of the shape:

```
{
  baseSha: string,
  headSha: string,
  prTitle?: string,
  prNumber?: number,
  scopes: Array<{
    scope: string,
    mode: 'patch' | 'regen' | 'delete',
    events: Array<DossierEventInput>
  }>
}
```

The handler SHALL:

1. Resolve the `Repository` row by `:repoId` and authorize the requesting user as an org member of the repository's project.
2. Instantiate `Dossier(repoId)`, merge the EventBus publisher context, and call `applyPushUpdate` with the request body.
3. Commit the aggregate, returning `{ dossierUpdatedId }` (the ULID of the `DossierUpdated` event).

The endpoint SHALL execute the entire emit + persist + cascade pipeline synchronously inside one HTTP request scope.

#### Scenario: Valid push by org member

- **WHEN** an authenticated org member POSTs a well-formed payload for a repo in their project
- **THEN** the response returns 200 with `{ dossierUpdatedId }`
- **AND** the full event chain is persisted to `project_events`
- **AND** the response is returned without waiting for the compendium worker to complete

#### Scenario: Push by non-member

- **WHEN** an authenticated user who is not an org member of the repo's project posts a payload
- **THEN** the response returns 404 ("Not found")
- **AND** no events are persisted

#### Scenario: Missing repo

- **WHEN** the `:repoId` path parameter does not match any `repositories.id`
- **THEN** the response returns 404
- **AND** no events are persisted

### Requirement: Dossier event types

The system SHALL define the following concrete domain event classes, each extending `BaseDomainEvent`:

- `DossierUpdateFired` — kickoff marker; `scope = null`; `bodies = null`; `instructions = null`; `meta` carries `{ baseSha, headSha, prTitle?, prNumber? }`
- `DossierPatchComputed` — per scope; `scope` set; `instructions` carries the raw patch.md from the CLI; `bodies = null`; `meta` carries `{ model, inputTokens, outputTokens, costUsd, changedSlugs[] }`
- `DossierPatchApplied` — per scope; `bodies` carries the applied page contents keyed by changed slug; `title` set to the CLI-supplied title; `meta` carries `{ sources[], slugCounts, sample, model, inputTokens, outputTokens, costUsd }`
- `DossierPatchDescribed` — per scope; `title` set to the CLI haiku description (≤ 30 words, references concrete identifiers); `meta` carries `{ model, inputTokens, outputTokens, costUsd }`
- `DossierRegenApplied` — per scope; `bodies` carries the full 4 page contents; `meta` carries `{ reason: 'auto' | 'forced' | 'genesis', sources[], model, inputTokens, outputTokens, costUsd }`
- `DossierRegenDescribed` — per scope; `title` set to the CLI haiku description; `meta` carries `{ model, inputTokens, outputTokens, costUsd }`
- `DossierScopeRemoved` — per scope; `title` set to `"removed scope <name>"`; `meta` carries `{ lastKnownSlugs[] }`
- `DossierUpdated` — repo-level roll-up; `scope = null`; `title` set to PR/git subject; `meta` carries `{ totalCostUsd, scopes: [{ name, mode }] }`

#### Scenario: Persisted row matches event type

- **WHEN** any of the above events is persisted
- **THEN** the `project_events.type` column contains the event class name verbatim (e.g. `"DossierPatchApplied"`)

### Requirement: Per-repository materialized view `dossier_pages`

The system SHALL maintain a `dossier_pages` table that holds the current page bodies for every (repo, scope, slug) tuple in the system. The table SHALL contain:

- `id` uuid primary key (auto-generated)
- `org_id` uuid NOT NULL FK with cascade
- `project_id` uuid NOT NULL FK with cascade
- `repo_id` uuid NOT NULL FK with cascade
- `scope` text NOT NULL
- `slug` text NOT NULL
- `title` text NOT NULL
- `content` text NOT NULL — markdown body including the frontmatter block inline
- `sources` text[] NOT NULL DEFAULT `'{}'`
- `related` text[] NOT NULL DEFAULT `'{}'`
- `frontmatter` jsonb NOT NULL DEFAULT `'{}'` — parsed YAML frontmatter, derived from `content` on every write
- `updated_at` timestamptz NOT NULL DEFAULT `now()`

The table SHALL have a unique index on `(repo_id, scope, slug)` and a secondary index on `(project_id, repo_id)`.

When a `DossierPatchApplied` or `DossierRegenApplied` event is persisted, the handler chain SHALL upsert the affected `dossier_pages` rows. When a `DossierScopeRemoved` event is persisted, all rows for that `(repo_id, scope)` SHALL be deleted.

#### Scenario: Patch applied upserts changed slugs

- **WHEN** a `DossierPatchApplied` event with bodies for slugs `['service', 'config']` is persisted
- **THEN** exactly two `dossier_pages` rows for that `(repo_id, scope)` are inserted or updated
- **AND** rows for the other two slugs of that scope are left untouched

#### Scenario: Regen applied upserts all four slugs

- **WHEN** a `DossierRegenApplied` event with bodies for all four slugs is persisted
- **THEN** all four `dossier_pages` rows for that `(repo_id, scope)` are inserted or updated

#### Scenario: Scope removal deletes rows

- **WHEN** a `DossierScopeRemoved` event for scope `foo` is persisted
- **THEN** every `dossier_pages` row with that `repo_id` and `scope = 'foo'` is deleted

#### Scenario: Frontmatter parsed on upsert

- **WHEN** an event with a body whose markdown begins with a `---` YAML block is upserted
- **THEN** the `frontmatter` column contains the parsed YAML as a JSON object
- **AND** the `content` column still contains the original markdown body including the frontmatter block

### Requirement: Dossier snapshot read endpoint

The system SHALL expose `GET /v2/repos/:repoId/dossier` protected by `FabrickAuthGuard`. The endpoint SHALL return the full set of `dossier_pages` rows for the given repo grouped by scope and slug. The response shape SHALL be:

```
{
  scopes: Array<{
    scope: string,
    pages: Array<{
      slug: string,
      title: string,
      content: string,
      sources: string[],
      related: string[],
      frontmatter: object,
      updatedAt: string
    }>
  }>
}
```

#### Scenario: Empty repo

- **WHEN** an authenticated org member requests the dossier of a repo with no `dossier_pages` rows
- **THEN** the response returns `{ scopes: [] }`

#### Scenario: Populated repo

- **WHEN** the dossier has two scopes with three and four pages respectively
- **THEN** the response contains two scope entries with three and four page entries respectively, sorted alphabetically by scope name and then slug

#### Scenario: Non-member access

- **WHEN** a non-member requests the endpoint
- **THEN** the response returns 404
