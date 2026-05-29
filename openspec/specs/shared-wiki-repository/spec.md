## ADDED Requirements

### Requirement: WikiRepository interface defines page storage contract
The shared library SHALL export a `WikiRepository` interface and a `WIKI_REPOSITORY` DI injection token. The interface SHALL define methods: `findBySlug(projectId, slug)`, `findBySlugs(projectId, slugs[])`, `findByProject(projectId)`, `findCategories(projectId)`, `findByCategory(projectId, category)`, `upsert(projectId, pages[])`, `delete(projectId, slugs[])`.

#### Scenario: Interface is importable by consuming apps
- **WHEN** api, synthesis, or sandbox app imports from `@app/shared`
- **THEN** `WikiRepository` interface and `WIKI_REPOSITORY` token are available

#### Scenario: All methods are defined
- **WHEN** a class implements `WikiRepository`
- **THEN** it MUST implement `findBySlug`, `findBySlugs`, `findByProject`, `findCategories`, `findByCategory`, `upsert`, and `delete`

### Requirement: WikiRepository provides cheap metadata projections
`WikiRepository` implementations SHALL expose two metadata-only projections used by the agentic search tools: `findCategories(projectId)` returns the distinct list of `category` values for the project; `findByCategory(projectId, category)` returns pages restricted to that category, projected to `{ slug, title, one_liner }` where `one_liner` is the first non-empty line of `content` after the title heading. These projections SHALL NOT load full page content.

#### Scenario: findCategories returns distinct categories
- **WHEN** a project has pages in categories `apps`, `entities`, and `logic`
- **THEN** `findCategories(projectId)` returns `["apps", "entities", "logic"]` (order unspecified, but distinct)

#### Scenario: findCategories on empty project
- **WHEN** a project has no pages
- **THEN** `findCategories(projectId)` returns `[]`

#### Scenario: findByCategory projects metadata only
- **WHEN** `findByCategory(projectId, "apps")` is called
- **THEN** the result contains one entry per page in that category
- **AND** each entry has `slug`, `title`, and `one_liner`
- **AND** no entry contains full page content

#### Scenario: findByCategory on unknown category
- **WHEN** `findByCategory(projectId, "missing")` is called and no pages match
- **THEN** the result is `[]`

#### Scenario: TypeORM implementation uses SELECT projection
- **WHEN** `TypeOrmWikiRepository.findCategories` is called
- **THEN** the query uses `SELECT DISTINCT category` and does not load `content`
- **WHEN** `TypeOrmWikiRepository.findByCategory` is called
- **THEN** the query selects only `slug`, `title`, and the leading line of `content`

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
