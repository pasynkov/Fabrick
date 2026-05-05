## ADDED Requirements

### Requirement: Standardized error response format
The system SHALL return structured error responses with field-specific validation details for project settings operations.

#### Scenario: Multiple validation errors returned with field context
- **WHEN** user submits project settings with multiple validation errors
- **THEN** system returns HTTP 400 with structured error response containing field-specific error messages

#### Scenario: Single validation error includes field information
- **WHEN** user submits project settings with invalid API key format
- **THEN** system returns error response with field "anthropicApiKey" and message "API key must start with sk-ant-"

### Requirement: Consistent success response structure
The system SHALL return complete updated project data after successful settings updates, including all computed fields.

#### Scenario: Successful update returns complete project data
- **WHEN** user successfully updates project settings
- **THEN** system returns HTTP 200 with full project object including id, name, slug, orgId, and autoSynthesisEnabled

#### Scenario: API key status refreshed in response
- **WHEN** user updates project API key
- **THEN** response includes updated API key status and hash information

### Requirement: Optimistic concurrency handling
The system SHALL handle concurrent project updates gracefully and provide clear feedback when conflicts occur.

#### Scenario: Concurrent update conflict detected
- **WHEN** two users attempt to update the same project simultaneously
- **THEN** second update receives HTTP 409 with retry guidance

#### Scenario: Stale data update prevention
- **WHEN** user submits update based on outdated project data
- **THEN** system validates current state and provides refresh guidance if needed

### Requirement: Audit trail consistency
The system SHALL log all project settings changes with consistent metadata for security and compliance tracking.

#### Scenario: Settings change logged with user context
- **WHEN** user updates project settings
- **THEN** system logs change with user ID, IP address, timestamp, and changed fields

#### Scenario: API key changes logged without exposing key values
- **WHEN** user updates project API key
- **THEN** system logs key hash change without storing actual key values in logs