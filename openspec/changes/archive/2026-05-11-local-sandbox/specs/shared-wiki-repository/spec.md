## ADDED Requirements

### Requirement: WikiRepository interface defines page storage contract
The shared library SHALL export a `WikiRepository` interface and a `WIKI_REPOSITORY` DI injection token. The interface SHALL define methods: `findBySlug(projectId, slug)`, `findBySlugs(projectId, slugs[])`, `findByProject(projectId)`, `upsert(projectId, pages[])`, `delete(projectId, slugs[])`.

#### Scenario: Interface is importable by consuming apps
- **WHEN** api, synthesis, or sandbox app imports from `@app/shared`
- **THEN** `WikiRepository` interface and `WIKI_REPOSITORY` token are available

#### Scenario: All methods are defined
- **WHEN** a class implements `WikiRepository`
- **THEN** it MUST implement findBySlug, findBySlugs, findByProject, upsert, and delete

### Requirement: Shared types define wiki page data structures
The shared library SHALL export `WikiPageData` and `ExistingPage` types used by synthesis and search impls.

#### Scenario: WikiPageData contains all page fields
- **WHEN** `WikiPageData` type is used
- **THEN** it contains: slug, category, title, content, sources (string[]), related (string[])

#### Scenario: Types are reused across apps
- **WHEN** api, synthesis, or sandbox references wiki page structures
- **THEN** they import from `@app/shared` types, not local definitions

### Requirement: SharedModule exports providers via DI
The shared library SHALL export a `SharedModule` that registers `SynthesisImpl` and `SearchImpl` as providers. Consuming apps SHALL provide their own `WikiRepository` implementation bound to the `WIKI_REPOSITORY` token.

#### Scenario: Sandbox provides FS implementation
- **WHEN** sandbox app imports `SharedModule` and provides `FsWikiRepository` for `WIKI_REPOSITORY`
- **THEN** `SearchImpl` and `SynthesisImpl` receive `FsWikiRepository` via injection

#### Scenario: API provides TypeORM implementation
- **WHEN** api app imports `SharedModule` and provides `TypeOrmWikiRepository` for `WIKI_REPOSITORY`
- **THEN** `SearchImpl` receives `TypeOrmWikiRepository` via injection
