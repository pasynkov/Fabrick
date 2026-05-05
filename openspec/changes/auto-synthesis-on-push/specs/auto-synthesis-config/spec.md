## ADDED Requirements

### Requirement: Per-project auto-synthesis settings
The system SHALL allow configuration of auto-synthesis behavior per project.

#### Scenario: Auto-synthesis enabled for project
- **WHEN** project auto-synthesis is enabled in configuration
- **THEN** push events for that project trigger synthesis

#### Scenario: Auto-synthesis disabled for project
- **WHEN** project auto-synthesis is disabled in configuration
- **THEN** push events for that project are ignored

### Requirement: File type filtering configuration
The system SHALL allow configuration of which file types trigger synthesis.

#### Scenario: Source code files trigger synthesis
- **WHEN** project is configured with default file filters
- **THEN** changes to .ts, .js, .py, .go, .java, .cpp files trigger synthesis

#### Scenario: Documentation files excluded
- **WHEN** project uses default file filters
- **THEN** changes to .md, .txt, .rst files do not trigger synthesis

#### Scenario: Custom file filters respected
- **WHEN** project defines custom include/exclude file patterns
- **THEN** only matching file changes trigger synthesis

### Requirement: Rate limiting configuration
The system SHALL allow configuration of synthesis rate limits per project.

#### Scenario: Default rate limiting applied
- **WHEN** project has no custom rate limit configuration
- **THEN** system applies default rate limit of 1 synthesis per 5 minutes

#### Scenario: Custom rate limits respected
- **WHEN** project defines custom rate limit settings
- **THEN** system applies project-specific rate limits

### Requirement: Branch filtering configuration
The system SHALL allow configuration of which branches trigger auto-synthesis.

#### Scenario: Main branch synthesis enabled
- **WHEN** project is configured for main branch synthesis
- **THEN** pushes to main/master branch trigger synthesis

#### Scenario: Feature branch synthesis disabled
- **WHEN** project is configured for main branch only
- **THEN** pushes to feature branches are ignored

#### Scenario: All branches synthesis enabled
- **WHEN** project is configured for all branch synthesis
- **THEN** pushes to any branch trigger synthesis

### Requirement: Configuration API endpoints
The system SHALL provide API endpoints for managing auto-synthesis configuration.

#### Scenario: Project configuration retrieved
- **WHEN** GET request is made to `/api/projects/{id}/auto-synthesis`
- **THEN** system returns current auto-synthesis configuration

#### Scenario: Project configuration updated
- **WHEN** PUT request is made to `/api/projects/{id}/auto-synthesis` with valid settings
- **THEN** system updates configuration and returns confirmation

#### Scenario: Invalid configuration rejected
- **WHEN** configuration update includes invalid settings
- **THEN** system returns HTTP 400 with validation errors