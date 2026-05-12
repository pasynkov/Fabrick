## ADDED Requirements

### Requirement: SearchImpl logs each pipeline stage
`SearchImpl.search()` SHALL emit structured log entries at entry, after slug selection, and after page load using the NestJS `Logger` instance.

#### Scenario: Entry log on search start
- **WHEN** `search()` is called
- **THEN** a log entry is emitted containing `projectId` and `question`

#### Scenario: Slug selection log after LLM step 1
- **WHEN** Claude returns the selected slugs array
- **THEN** a log entry is emitted containing the selected slugs

#### Scenario: Page load log after WikiRepository fetch
- **WHEN** pages are loaded from WikiRepository
- **THEN** a log entry is emitted containing the count of loaded pages and their slugs
