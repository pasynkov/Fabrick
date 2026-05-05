## ADDED Requirements

### Requirement: Project settings page with auto-synthesis toggle
The console SHALL provide a project settings page that displays project configuration including name, API key management, and auto-synthesis toggle. The page SHALL allow updating these settings with appropriate validation and hash-based change detection.

#### Scenario: Project settings page displayed
- **WHEN** user navigates to project settings
- **THEN** form displays current project name, API key hash status, and auto-synthesis toggle

#### Scenario: Project settings updated
- **WHEN** user modifies settings and saves
- **THEN** project is updated with new values and user sees success confirmation

#### Scenario: API key hash displayed immediately
- **WHEN** settings page loads
- **THEN** API key hash or status is shown without requiring user interaction

### Requirement: Project API key management with hash display
The project settings page SHALL support API key configuration with immediate hash display and hash-based change detection to prevent unnecessary resubmission.

#### Scenario: API key field with hash status
- **WHEN** user views project settings
- **THEN** API key field shows current hash status and accepts new key input

#### Scenario: Hash-based change detection
- **WHEN** user saves settings without changing API key
- **THEN** API key field is excluded from update request to preserve existing key