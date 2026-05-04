## MODIFIED Requirements

### Requirement: Organization API key management with enhanced error handling
The system SHALL expose PATCH /orgs/:orgId accepting anthropicApiKey field with comprehensive validation, enhanced error messages, and improved security handling.

#### Scenario: API key update with detailed validation feedback
- **WHEN** an org admin sends PATCH /orgs/:orgId with an invalid API key format
- **THEN** the system returns HTTP 400 with detailed validation errors including specific format requirements and troubleshooting guidance

#### Scenario: Enhanced authorization error handling
- **WHEN** a non-admin attempts to update organization API key
- **THEN** the system returns HTTP 403 with clear explanation of required permissions and steps to request admin access

#### Scenario: Rate limiting protection
- **WHEN** rapid successive API key update attempts occur from the same user
- **THEN** the system applies rate limiting and returns HTTP 429 with retry-after information

### Requirement: Project API key management with inheritance guidance
The system SHALL expose PATCH /projects/:projectId accepting anthropicApiKey field with enhanced inheritance explanation and cost impact guidance.

#### Scenario: Project API key update with inheritance impact explanation
- **WHEN** setting a project-specific API key when organization key exists
- **THEN** the system provides response indicating inheritance change and cost isolation implications

#### Scenario: Project API key removal with fallback confirmation
- **WHEN** removing a project-specific API key that will fallback to organization key
- **THEN** the system confirms the fallback behavior and potential cost attribution changes

### Requirement: Enhanced API key status endpoints with resolution details
The system SHALL provide GET /orgs/:orgId/api-key/status and GET /projects/:projectId/api-key/status with detailed resolution information and health status.

#### Scenario: Organization API key health status
- **WHEN** requesting organization API key status
- **THEN** the system includes last validation timestamp, usage health indicators, and any detected issues

#### Scenario: Project API key resolution chain visualization
- **WHEN** requesting project API key status
- **THEN** the system provides detailed resolution chain showing effective source, inheritance path, and configuration recommendations

### Requirement: Audit log endpoints with enhanced filtering and security
The system SHALL provide audit log endpoints with improved filtering, search capabilities, and security event detection.

#### Scenario: Advanced audit log filtering
- **WHEN** requesting audit logs with specific criteria
- **THEN** the system supports filtering by date range, action type, user, and security event classification

#### Scenario: Security event highlighting in audit logs
- **WHEN** retrieving audit logs containing security events
- **THEN** the system highlights failed authentication attempts, unauthorized access, and suspicious patterns