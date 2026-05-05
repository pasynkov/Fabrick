## ADDED Requirements

### Requirement: Per-project auto-synthesis settings
The system SHALL allow configuration of auto-synthesis behavior per project.

#### Scenario: Auto-synthesis enabled for project
- **WHEN** project auto-synthesis is enabled in configuration
- **THEN** `fabrick push` automatically triggers synthesis after a successful push

#### Scenario: Auto-synthesis disabled for project
- **WHEN** project auto-synthesis is disabled in configuration
- **THEN** `fabrick push` prompts the user to run synthesis instead of triggering automatically

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