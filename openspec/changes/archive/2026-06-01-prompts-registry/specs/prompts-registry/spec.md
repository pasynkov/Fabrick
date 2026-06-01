## ADDED Requirements

### Requirement: prompt_revisions table holds immutable, multi-file prompt content keyed by (name, agent, revision)
The system SHALL provide a Postgres table `prompt_revisions` with columns: `id uuid primary key`, `name varchar not null`, `agent varchar not null`, `revision int not null`, `content jsonb not null`, `note text null`, `created_by uuid null`, `created_at timestamp not null default now()`. The `content` column SHALL be a JSON object of the shape `{ "files": { "<relative path>": "<file body>", ... } }`. A `UNIQUE` constraint SHALL exist on `(name, agent, revision)`. An index on `(name, agent, revision DESC)` SHALL exist to make "latest" lookups efficient. Rows SHALL NOT be mutated after insert; any change to prompt content SHALL be expressed as a new row with `revision = MAX(revision) + 1` for that `(name, agent)`.

#### Scenario: Latest revision per (name, agent) is MAX(revision)
- **WHEN** the table contains rows for `(search, claude, 1)`, `(search, claude, 2)`, and `(synthesis, claude, 1)`
- **THEN** the latest `search/claude` content is the row with `revision = 2`
- **AND** the latest `synthesis/claude` content is the row with `revision = 1`

#### Scenario: Inserting a duplicate (name, agent, revision) fails
- **WHEN** code attempts to insert a second row with the same `(name, agent, revision)` triple
- **THEN** the database rejects the insert with a unique-constraint violation

#### Scenario: Multi-file content shape
- **WHEN** a row for `(fabrick-analyze, claude, 1)` is read
- **THEN** `content.files` is an object whose keys are file paths relative to the skill root (e.g., `SKILL.md`, `patterns.md`) and whose values are the full file body as text

#### Scenario: Single-string prompt content shape
- **WHEN** a row for `(search, claude, 1)` is read
- **THEN** `content.files` is an object with exactly one entry whose key is `prompt.md` and whose value is the full system prompt text

### Requirement: Seed migration populates revision 1 for all in-tree prompts
A TypeORM migration SHALL insert `revision: 1` rows for `(search, claude)`, `(synthesis, claude)`, `(fabrick-analyze, claude)`, and `(fabrick-push, claude)`. The seed migration SHALL be idempotent via `ON CONFLICT (name, agent, revision) DO NOTHING` so repeated runs are safe. The prompt content SHALL be vendored as TypeScript string constants inside the migration file (captured at migration-write time) so the migration is self-contained and not affected by later source-tree refactors.

#### Scenario: First run inserts four rows
- **WHEN** the seed migration runs against an empty `prompt_revisions` table
- **THEN** four rows are inserted with `revision = 1` and the names listed above

#### Scenario: Re-run is a no-op
- **WHEN** the seed migration runs against a `prompt_revisions` table that already contains those four rows
- **THEN** no rows are inserted, no errors are raised, and existing higher-numbered revisions are not affected

#### Scenario: Admin-created revisions are preserved
- **WHEN** the table already contains `(search, claude, 2)` created by an admin
- **AND** the seed migration runs
- **THEN** the existing `revision: 2` row is untouched and remains the latest

### Requirement: PromptRepository interface is the single boundary for prompt reads
The shared package SHALL export an interface `PromptRepository` and a DI token `PROMPT_REPOSITORY` from `applications/backend/shared/src`. The interface SHALL expose at least `getLatest(name: string, agent: string): Promise<PromptRecord>` where `PromptRecord` is `{ id: string, name: string, agent: string, revision: number, content: { files: Record<string, string> } }`. `SearchImpl`, `SynthesisImpl`, and any future shared consumer SHALL read prompts only through this interface — direct DB access, direct file reads, and in-source string constants for the production prompt body SHALL NOT remain in the shared package.

#### Scenario: getLatest returns the highest revision for the pair
- **WHEN** any implementation of `PromptRepository.getLatest('search', 'claude')` is called
- **AND** the underlying store has revisions 1, 2, 3 for that pair
- **THEN** the returned `PromptRecord` has `revision: 3` and `content` from that row

#### Scenario: Unknown (name, agent) throws
- **WHEN** `getLatest('unknown-prompt', 'claude')` is called
- **AND** no row exists for that pair
- **THEN** the call rejects with an error whose message names the missing `(name, agent)` pair

### Requirement: DbPromptRepository is the api-side implementation
The api SHALL provide `DbPromptRepository` in `applications/backend/api/src/prompts/` that implements `PromptRepository` over the `prompt_revisions` table via TypeORM. `getLatest(name, agent)` SHALL execute a single query ordered by `revision DESC` with `LIMIT 1`. The api `app.module.ts` SHALL bind `PROMPT_REPOSITORY` to `DbPromptRepository`.

#### Scenario: Single query per call
- **WHEN** `DbPromptRepository.getLatest('search', 'claude')` is called
- **THEN** exactly one SQL query is executed against `prompt_revisions`
- **AND** that query uses the `(name, agent, revision DESC)` index

### Requirement: FilePromptRepository is the sandbox implementation
The sandbox app SHALL provide `FilePromptRepository` in `applications/backend/sandbox/src/` that implements `PromptRepository` by reading from a committed `prompts/` directory. The directory layout SHALL mirror the DB shape: one subdirectory per `(name, agent)` pair containing one file per entry in `content.files`. `getLatest` SHALL always return `revision: 1` and an `id` derived deterministically from `sha256(name + '\n' + agent + '\n' + canonical(content.files))` truncated to the first 32 hex characters formatted as a UUID v4 string. The sandbox `sandbox.module.ts` SHALL bind `PROMPT_REPOSITORY` to `FilePromptRepository`.

#### Scenario: Sandbox reads search prompt from FS
- **WHEN** `FilePromptRepository.getLatest('search', 'claude')` is called
- **AND** the file `prompts/search/claude/prompt.md` exists
- **THEN** the returned record has `revision: 1` and `content.files['prompt.md']` equal to the file contents

#### Scenario: Sandbox has no DB dependency
- **WHEN** the sandbox app boots
- **THEN** it does not connect to Postgres for prompt reads
- **AND** it does not require the `prompt_revisions` table to exist

#### Scenario: id is stable across calls
- **WHEN** `FilePromptRepository.getLatest('search', 'claude')` is called twice without changing the underlying files
- **THEN** both calls return the same `id` value

### Requirement: search_requests and token_usage carry the prompt revision used
The `search_requests` table SHALL gain a nullable column `prompt_revision_id uuid` with a foreign key to `prompt_revisions(id)` and `ON DELETE SET NULL`. The `token_usage` table SHALL gain the same column with the same constraints. Rows written by the api after this change SHALL set `prompt_revision_id` to the `PromptRecord.id` value returned by the impl that produced the row. Pre-existing rows SHALL retain `NULL`.

#### Scenario: New search row records the revision
- **WHEN** `SearchService` persists a `search_requests` row after `SearchImpl.search()` returns
- **THEN** the row's `prompt_revision_id` equals the `promptRevisionId` returned by the impl
- **AND** that id matches a row in `prompt_revisions`

#### Scenario: New synthesis token_usage rows record the revision
- **WHEN** `SynthesisService` writes one or more `token_usage` rows attributable to a synthesis call
- **THEN** each row's `prompt_revision_id` equals the `promptRevisionId` returned by the synthesis impl

#### Scenario: Legacy rows remain NULL
- **WHEN** an existing row written before the migration is read
- **THEN** its `prompt_revision_id` is `NULL`
- **AND** querying joins against `prompt_revisions` tolerate that NULL via outer join semantics

### Requirement: SharedModule wires both wiki and prompt providers
`SharedModule` SHALL expose a static `for({ wiki, prompt }: { wiki: Provider; prompt: Provider })` builder that registers both providers and exports `SynthesisImpl` and `SearchImpl`. The legacy `forRepository(wikiProvider)` form SHALL be removed.

#### Scenario: api wires DB-backed repos
- **WHEN** the api boots
- **THEN** `SharedModule.for({ wiki: TypeOrmWikiRepository, prompt: DbPromptRepository })` is registered in `app.module.ts`

#### Scenario: sandbox wires FS-backed repos
- **WHEN** the sandbox app boots
- **THEN** `SharedModule.for({ wiki: FsWikiRepository, prompt: FilePromptRepository })` is registered in `sandbox.module.ts`
