## ADDED Requirements

### Requirement: SearchImpl performs 2-step Claude search using WikiRepository
`SearchImpl.search()` SHALL load the index page via WikiRepository, call Claude to select relevant slugs, **normalize selected slugs by stripping any `.md` suffix**, load selected pages via WikiRepository, call Claude to generate an answer. It SHALL return `{ answer, sources }`.

#### Scenario: Successful search with matching pages
- **WHEN** search is called with projectId, question, and apiKey
- **AND** WikiRepository has an index page and matching content pages
- **THEN** returns answer derived from selected pages and sources list of used slugs

#### Scenario: No index page
- **WHEN** search is called but WikiRepository has no page with slug "index"
- **THEN** throws an error indicating no wiki pages found

#### Scenario: No relevant slugs selected
- **WHEN** Claude slug selection returns empty array
- **THEN** returns `{ answer: "No relevant information found...", sources: [] }`

#### Scenario: Claude returns slugs with .md suffix
- **WHEN** Claude slug selection returns slugs like `["apps/harvester-conductor.md", "config/environment.md"]`
- **THEN** SearchImpl normalizes them to `["apps/harvester-conductor", "config/environment"]` before calling WikiRepository
- **AND** pages are found and returned correctly

### Requirement: SearchImpl injects WikiRepository via DI
`SearchImpl` SHALL receive WikiRepository through `@Inject(WIKI_REPOSITORY)` constructor injection. It SHALL NOT import or depend on any specific implementation (TypeORM, FS, HTTP).

#### Scenario: SearchImpl works with any WikiRepository implementation
- **WHEN** SearchImpl is instantiated with FsWikiRepository
- **THEN** it performs search using filesystem-backed pages
- **WHEN** SearchImpl is instantiated with TypeOrmWikiRepository
- **THEN** it performs search using Postgres-backed pages

### Requirement: Search prompts are inline in SearchImpl
System prompts for slug selection and answer generation SHALL be defined inline within `SearchImpl`. No external prompt files.

#### Scenario: Prompts are self-contained
- **WHEN** SearchImpl is used
- **THEN** it requires no external prompt files or assets — all prompts are in the source code
