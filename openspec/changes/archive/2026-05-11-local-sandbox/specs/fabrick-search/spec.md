## MODIFIED Requirements

### Requirement: Search service delegates to shared SearchImpl
The API search service SHALL delegate the 2-step Claude search logic (slug selection + answer generation) to shared `SearchImpl`. The API service SHALL remain responsible for auth checks, org/project resolution, and API key resolution. It SHALL provide `TypeOrmWikiRepository` to `SearchImpl` via DI.

#### Scenario: Search delegates to SearchImpl
- **WHEN** API receives a search request
- **THEN** API service validates auth and resolves project, then calls `SearchImpl.search()` which handles Claude calls and page loading via injected WikiRepository

#### Scenario: Existing search behavior is preserved
- **WHEN** a search is performed through the API
- **THEN** the response format `{ answer, sources }` is unchanged
- **AND** the 2-step Claude flow (slug selection → answer generation) is unchanged
