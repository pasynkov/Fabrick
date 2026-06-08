## ADDED Requirements

### Requirement: Append-only event store table

The system SHALL provide a `project_events` PostgreSQL table that records every domain event emitted by the dossier and compendium pipelines as one immutable row. The table SHALL never be updated or deleted from at runtime by application code.

The table SHALL contain the following columns:

- `id` char(26) primary key — ULID assigned by the application at event emission time
- `org_id` uuid NOT NULL — foreign key to `organizations.id` with `ON DELETE CASCADE`
- `project_id` uuid NULL — foreign key to `projects.id` with `ON DELETE CASCADE`
- `repo_id` uuid NULL — foreign key to `repositories.id` with `ON DELETE CASCADE`
- `scope` text NULL — scope name for per-scope events; NULL for repo-level and system-level events
- `type` text NOT NULL — discriminator naming one of the concrete domain event types
- `parent_id` char(26) NULL — cascade chain pointer to a parent event id; NULL only for top-level phase kickoffs
- `base_sha` text NULL, `head_sha` text NULL — git revision range for repo-level events
- `title` text NULL — human-readable title (PR/git subject for `DossierUpdated`, haiku description for `*Described`, inherited for `*Updated`)
- `bodies` jsonb NULL — slug → markdown body content with frontmatter inline
- `instructions` text NULL — raw patch.md text for `*PatchComputed` events
- `meta` jsonb NOT NULL DEFAULT `'{}'` — heterogeneous payload (model, costUsd, inputTokens, outputTokens, slugs[], sources[], slugCounts, sample, mode, reason, bundleRef)
- `pr_number` int NULL — pull request number when supplied by the CLI
- `at` timestamptz NOT NULL DEFAULT `now()` — server-side timestamp

The table SHALL have indexes on `(org_id, at DESC)`, `(project_id, at DESC)`, `(repo_id, at DESC)`, `(repo_id, scope, at DESC)`, `(parent_id)`, and `(type, at DESC)`.

#### Scenario: Event row written

- **WHEN** any domain event is emitted through the EventBus
- **THEN** exactly one row is inserted into `project_events` with `id` set to a fresh ULID, `type` set to the event class name, and the relevant FK columns populated for the aggregate's scope

#### Scenario: Foreign key cascade on parent project deletion

- **WHEN** a `projects` row is deleted (e.g. via the existing admin flow)
- **THEN** every `project_events` row referencing that `project_id` is deleted by the database cascade

#### Scenario: parent_id chain integrity

- **WHEN** a child event is written with `parent_id` set
- **THEN** the application SHALL guarantee that the parent event was already persisted in the same database transaction or in a prior committed transaction

### Requirement: Base domain event class

The system SHALL provide an abstract `BaseDomainEvent` class that every concrete domain event extends. The class SHALL define the contract through which the centralized persister maps an event instance to a `project_events` row.

`BaseDomainEvent` SHALL expose at minimum:

- `id: string` — the ULID assigned at construction time
- `type: string` — abstract; the concrete event's discriminator string
- `orgId: string`, `projectId: string | null`, `repoId: string | null`, `scope: string | null`
- `parentId: string | null`
- `title: string | null`
- `bodies: Record<string, string> | null`
- `instructions: string | null`
- `meta: Record<string, unknown>`
- `baseSha: string | null`, `headSha: string | null`, `prNumber: number | null`
- A `toEntity()` method that returns a `ProjectEvent` TypeORM entity instance ready to be saved.

#### Scenario: Concrete event extends BaseDomainEvent

- **WHEN** a new concrete event class is added (e.g. `DossierPatchApplied`)
- **THEN** the class extends `BaseDomainEvent`, sets `type` to its discriminator, and populates the relevant fields in its constructor without doing any I/O

#### Scenario: Event instance maps to row

- **WHEN** `toEntity()` is called on a populated event instance
- **THEN** it returns a `ProjectEvent` entity whose column values match the event's fields one-to-one

### Requirement: Centralized event persistence handler

The system SHALL provide a single `PersistEventHandler` class registered as a NestJS CQRS `@EventsHandler` for every concrete domain event type. Business handlers SHALL NOT write to `project_events` directly; they SHALL emit domain events through an aggregate root or `EventBus`, and persistence SHALL be the sole responsibility of `PersistEventHandler`.

`PersistEventHandler` SHALL call `event.toEntity()` and `repository.save()` for every event it receives.

#### Scenario: Domain event triggers persistence

- **WHEN** any registered domain event is published on the EventBus
- **THEN** `PersistEventHandler` receives the event and writes the corresponding row to `project_events` before the originating request returns

#### Scenario: Adding a new event type

- **WHEN** a new concrete event class is added to the codebase
- **THEN** the class is added to the `@EventsHandler` decorator list on `PersistEventHandler`, and no other persistence wiring change is required

#### Scenario: Business handler does not write directly

- **WHEN** a business handler (e.g. `DossierUpdatedHandler`, `ProcessCompendiumResultHandler`) processes an event or command
- **THEN** it MUST NOT call the `ProjectEvent` repository directly; all `project_events` writes MUST flow through `PersistEventHandler`

### Requirement: ULID generator

The system SHALL provide a `UlidService` that returns lexicographically sortable 26-character ULID strings, used for every `project_events.id`.

#### Scenario: Generated IDs sort by time

- **WHEN** two events are generated more than one millisecond apart
- **THEN** the later event's ULID sorts strictly greater than the earlier one when compared as a string
