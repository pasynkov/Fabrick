## MODIFIED Requirements

### Requirement: Search service delegates to shared SearchImpl
The API search service SHALL delegate search to shared `SearchImpl`, which performs an agentic tool-use loop over the project wiki. The API service SHALL remain responsible for auth checks, org/project resolution, and API key resolution. It SHALL provide `TypeOrmWikiRepository` to `SearchImpl` via DI.

#### Scenario: Search delegates to SearchImpl
- **WHEN** API receives a search request
- **THEN** API service validates auth and resolves project, then calls `SearchImpl.search()`, which runs the agentic loop and page loading via the injected `WikiRepository`

#### Scenario: Existing search response shape is preserved
- **WHEN** a search is performed through the API
- **THEN** the response shape `{ answer, sources }` is unchanged
- **AND** `answer` contains no trailing `SOURCES:` line (it is parsed out by `SearchImpl`)
- **AND** `sources` is the slug list the model curated in its final answer
