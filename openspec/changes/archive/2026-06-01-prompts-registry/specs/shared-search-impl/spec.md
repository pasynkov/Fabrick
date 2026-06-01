## MODIFIED Requirements

### Requirement: SearchImpl injects WikiRepository via DI
`SearchImpl` SHALL receive `WikiRepository` through `@Inject(WIKI_REPOSITORY)` and `PromptRepository` through `@Inject(PROMPT_REPOSITORY)` constructor injection. It SHALL NOT import or depend on any specific implementation (TypeORM, FS, HTTP) of either repository.

#### Scenario: SearchImpl works with any WikiRepository implementation
- **WHEN** `SearchImpl` is instantiated with `FsWikiRepository`
- **THEN** it performs the agentic loop using filesystem-backed pages
- **WHEN** `SearchImpl` is instantiated with `TypeOrmWikiRepository`
- **THEN** it performs the agentic loop using Postgres-backed pages

#### Scenario: SearchImpl works with any PromptRepository implementation
- **WHEN** `SearchImpl` is instantiated with `DbPromptRepository`
- **THEN** it loads the system prompt from the database
- **WHEN** `SearchImpl` is instantiated with `FilePromptRepository`
- **THEN** it loads the system prompt from the filesystem

## REMOVED Requirements

### Requirement: Search prompts are inline in SearchImpl
**Reason**: Prompts moved to the `prompt_revisions` table and are read via `PromptRepository` at call time so they can be edited by PlatformAdmin without a code deploy and so analytics rows can attribute the exact revision used.
**Migration**: Source code SHALL NOT contain the full search system prompt string after this change. The seed migration of `prompts-registry` inserts the prior prompt body as `(name='search', agent='claude', revision=1)`. Consumers SHALL read it via `PromptRepository.getLatest('search', 'claude')`.

## ADDED Requirements

### Requirement: Search prompts are loaded from PromptRepository
The system prompt — including agent role description, tool guidance, and worked examples — SHALL be loaded at call time via `PromptRepository.getLatest('search', 'claude')`. The full prompt body SHALL live in `content.files['prompt.md']`. No inline string constant containing the full system prompt SHALL remain in `SearchImpl` or anywhere else in the shared package.

#### Scenario: Prompt fetched on every search call
- **WHEN** `SearchImpl.search()` is called
- **THEN** it invokes `PromptRepository.getLatest('search', 'claude')` exactly once before building the Anthropic request
- **AND** uses the returned `content.files['prompt.md']` as the system block text

#### Scenario: Missing prompt fails loudly
- **WHEN** `PromptRepository.getLatest('search', 'claude')` rejects with a not-found error
- **THEN** `SearchImpl.search()` propagates that error without falling back to any inline constant

### Requirement: SearchImpl returns the prompt revision id alongside its result
`SearchImpl.search()` SHALL return `{ answer, sources, metrics, promptRevisionId }` where `promptRevisionId` is the `id` field of the `PromptRecord` returned by the `getLatest` call that fetched the system prompt for that invocation. Callers — including `SearchService` in the api — MAY use this id to attribute analytics rows.

#### Scenario: promptRevisionId is the id from getLatest
- **WHEN** `PromptRepository.getLatest('search', 'claude')` returns a record with `id: 'abc-123'`
- **AND** `SearchImpl.search()` completes successfully
- **THEN** the result object's `promptRevisionId` equals `'abc-123'`

#### Scenario: Budget-cap finalization still returns the id
- **WHEN** `SearchImpl.search()` hits a budget cap and finalizes via the partial-answer path
- **THEN** the returned result still contains the `promptRevisionId` from the same `getLatest` call made at the start
