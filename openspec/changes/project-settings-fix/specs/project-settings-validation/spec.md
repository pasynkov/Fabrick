## ADDED Requirements

### Requirement: Consistent API key format validation
The system SHALL validate Anthropic API key format consistently across frontend and backend, requiring keys to start with "sk-ant-" and rejecting empty strings when provided.

#### Scenario: Valid API key format accepted
- **WHEN** user submits project settings with API key "sk-ant-api03000000_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
- **THEN** system accepts the key and updates project settings

#### Scenario: Invalid API key format rejected
- **WHEN** user submits project settings with API key "invalid-key-format"
- **THEN** system returns validation error "API key must start with sk-ant-"

#### Scenario: Empty API key string rejected
- **WHEN** user submits project settings with API key as empty string ""
- **THEN** system treats it as null/undefined to clear the key rather than validation error

### Requirement: Project name validation consistency
The system SHALL validate project names consistently, requiring non-empty strings after trimming whitespace and enforcing maximum length of 128 characters.

#### Scenario: Valid project name accepted
- **WHEN** user submits project settings with name "My Project"
- **THEN** system trims whitespace and updates project name

#### Scenario: Empty project name rejected
- **WHEN** user submits project settings with name that is empty or only whitespace
- **THEN** system returns validation error "Project name cannot be empty"

#### Scenario: Overly long project name rejected
- **WHEN** user submits project settings with name longer than 128 characters
- **THEN** system returns validation error "Project name must not exceed 128 characters"

### Requirement: Real-time frontend validation
The frontend SHALL provide immediate validation feedback without requiring server roundtrip for basic format issues.

#### Scenario: Frontend shows API key format error immediately
- **WHEN** user types invalid API key format in the settings form
- **THEN** frontend displays format error before form submission

#### Scenario: Frontend shows character count for project name
- **WHEN** user types in project name field
- **THEN** frontend displays "X/128" character count in real-time

#### Scenario: Frontend prevents submission with validation errors
- **WHEN** form has validation errors
- **THEN** submit button is disabled and errors are highlighted