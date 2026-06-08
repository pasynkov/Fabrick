## ADDED Requirements

### Requirement: Organization-level linear events feed

The system SHALL expose `GET /v2/orgs/:orgId/events` protected by `FabrickAuthGuard`. The endpoint SHALL return events from `project_events` where `org_id = :orgId` sorted by `at DESC, id DESC` for stable pagination, with shape:

```
{
  events: Array<ProjectEventDto>,
  nextCursor: string | null
}
```

The endpoint SHALL accept query parameters:

- `since` (optional, ULID): return events with `id < since` (older than the cursor)
- `limit` (optional, default 50, max 200): page size
- `types` (optional, comma-separated): wildcard glob over event type names, e.g. `*Updated` or `Dossier*,Compendium*`

`ProjectEventDto` SHALL contain `{ id, type, parentId, orgId, projectId, repoId, scope, title, baseSha, headSha, prNumber, bodies, instructions, meta, at }`.

#### Scenario: Default page

- **WHEN** an authenticated org member requests `/v2/orgs/:orgId/events` with no query params
- **THEN** the response returns up to 50 most recent events for that org, sorted newest first
- **AND** `nextCursor` is set to the last returned event's id if more events exist

#### Scenario: Cursor pagination

- **WHEN** the request includes `since=<ulid>`
- **THEN** the response returns events with id strictly less than the cursor

#### Scenario: Type filter

- **WHEN** the request includes `types=*Updated`
- **THEN** only events whose `type` matches the glob (e.g. `DossierUpdated`, `CompendiumUpdated`) are returned

#### Scenario: Non-member access

- **WHEN** the requesting user is not an org member of `:orgId`
- **THEN** the response returns 404

### Requirement: Project-level linear events feed

The system SHALL expose `GET /v2/projects/:projectId/events` with the same query parameters, response shape, auth, and pagination semantics as the org feed, but filtered by `project_id = :projectId`.

#### Scenario: Default page

- **WHEN** an authenticated org member of the project's org requests the project feed
- **THEN** events scoped to the project are returned newest first

#### Scenario: Non-member access

- **WHEN** the requester is not a member of the project's org
- **THEN** the response returns 404

### Requirement: Repository-level linear events feed

The system SHALL expose `GET /v2/repos/:repoId/events` with the same parameters, shape, auth, and pagination as the org and project feeds, filtered by `repo_id = :repoId`.

#### Scenario: Default page

- **WHEN** an authenticated org member requests the repo feed
- **THEN** events scoped to the repo are returned newest first

### Requirement: Single event with children

The system SHALL expose `GET /v2/repos/:repoId/events/:eventId` protected by `FabrickAuthGuard`. The endpoint SHALL return:

```
{
  event: ProjectEventDto,
  children: ProjectEventDto[]
}
```

where `children` are all `project_events` rows with `parent_id = :eventId` sorted by `at ASC, id ASC` (oldest first within a phase, since chains are written in dependency order).

#### Scenario: DossierUpdated drill-down

- **WHEN** the client requests a `DossierUpdated` event id
- **THEN** the response returns the event itself plus all of its child scope events (Computed/Applied/Described/Removed) in chain order
- **AND** if a CompendiumRegenFired exists with this event as parent, it appears in the children array

#### Scenario: Leaf event

- **WHEN** the client requests an event id that has no children (e.g. a `DossierPatchDescribed`)
- **THEN** the response returns the event and an empty `children` array

#### Scenario: Cross-repo isolation

- **WHEN** the client requests an `:eventId` that exists but belongs to a different `:repoId`
- **THEN** the response returns 404

### Requirement: Read-only query handlers

The system SHALL implement the events feed endpoints as NestJS CQRS query handlers. Controllers SHALL delegate to `QueryBus.execute(...)` for every read, returning the handler result directly. Handlers SHALL be the only consumers of the `ProjectEvent` TypeORM repository for read operations.

#### Scenario: Endpoint dispatches via QueryBus

- **WHEN** a feed endpoint is invoked
- **THEN** the controller calls `this.queryBus.execute(new ListProjectEventsQuery(...))`
- **AND** the controller does not directly query the TypeORM repository

### Requirement: Type glob matcher

The system SHALL provide a glob matcher that accepts patterns with `*` wildcards (e.g. `*Updated`, `Dossier*`, `Compendium*Applied`) and produces an equivalent SQL `LIKE`/`ILIKE` clause or in-memory predicate. Multiple comma-separated patterns SHALL be treated as a disjunction (OR).

#### Scenario: Single wildcard

- **WHEN** the filter is `*Updated`
- **THEN** events with type ending in `Updated` match

#### Scenario: Multiple patterns

- **WHEN** the filter is `Dossier*Applied,Compendium*Applied`
- **THEN** events whose type matches either pattern match
