## ADDED Requirements

### Requirement: Organization settings page with API key management
The console SHALL provide an organization settings page that displays organization configuration including name and API key management with hash display. The page SHALL NOT include auto-synthesis toggle as synthesis is project-scoped.

#### Scenario: Organization settings page displayed
- **WHEN** user navigates to organization settings
- **THEN** form displays current organization name and API key hash status

#### Scenario: Organization settings updated
- **WHEN** user modifies organization settings and saves
- **THEN** organization is updated with new values and user sees success confirmation

#### Scenario: Organization API key hash displayed
- **WHEN** organization settings page loads
- **THEN** API key hash or status is shown immediately

### Requirement: Organization API key management
The organization settings page SHALL support API key configuration with hash display and change detection, following the same patterns as project settings but excluding synthesis-related functionality.

#### Scenario: API key field with hash status in org settings
- **WHEN** user views organization settings
- **THEN** API key field shows current hash status and accepts new key input

#### Scenario: Hash-based change detection in org settings
- **WHEN** user saves organization settings without changing API key
- **THEN** API key field is excluded from update request to preserve existing key