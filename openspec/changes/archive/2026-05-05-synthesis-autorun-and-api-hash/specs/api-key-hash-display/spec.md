## ADDED Requirements

### Requirement: API key hash display in settings forms
The project and organization settings pages SHALL display the API key hash immediately when the form loads, showing the truncated hash format (last 8 characters) preceded by ellipsis. If no API key is configured, appropriate status text SHALL be displayed.

#### Scenario: Hash displayed for configured API key
- **WHEN** user opens settings page and project/org has an API key configured
- **THEN** truncated hash is displayed in format "...a1b2c3d4"

#### Scenario: Status shown for missing API key
- **WHEN** user opens settings page and project/org has no API key configured
- **THEN** status indicates no API key is set

#### Scenario: Hash updates after API key change
- **WHEN** user saves settings with a new API key
- **THEN** displayed hash updates to reflect the new key

### Requirement: API key status visibility
The settings forms SHALL provide immediate feedback about API key configuration status without requiring form submission or page reload.

#### Scenario: Immediate hash display on page load
- **WHEN** settings page loads
- **THEN** API key hash or status is displayed without user interaction