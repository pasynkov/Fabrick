## ADDED Requirements

### Requirement: class-validator dependency installation
The system SHALL install class-validator and class-transformer packages as production dependencies to enable DTO-based validation.

#### Scenario: Package installation
- **WHEN** the API application is built
- **THEN** class-validator and class-transformer are available as runtime dependencies

### Requirement: Auth controller DTO validation
The system SHALL create DTOs for all Auth controller endpoints with appropriate validation decorators.

#### Scenario: User registration validation
- **WHEN** a client sends POST /auth/register with invalid data
- **THEN** the system returns HTTP 400 with validation error details in NestJS standard format

#### Scenario: Login validation
- **WHEN** a client sends POST /auth/login with missing email or password
- **THEN** the system returns HTTP 400 with specific field validation errors

#### Scenario: MCP token validation
- **WHEN** a client sends POST /auth/mcp-token with missing orgSlug, projectSlug, or repoId
- **THEN** the system returns HTTP 400 with validation errors for missing required fields

### Requirement: Organizations controller DTO validation
The system SHALL create DTOs for Orgs controller with validation for organization names and member emails.

#### Scenario: Organization creation validation
- **WHEN** a client sends POST /orgs with empty or invalid name
- **THEN** the system returns HTTP 400 with validation error for name field

#### Scenario: Member addition email validation
- **WHEN** a client sends POST /orgs/:orgId/members with invalid email format
- **THEN** the system returns HTTP 400 with email format validation error

#### Scenario: Organization name update validation
- **WHEN** a client sends PATCH /orgs/:orgId with name longer than 128 characters
- **THEN** the system returns HTTP 400 with length validation error

### Requirement: Repos controller DTO validation
The system SHALL create DTOs for all repository and project operations with appropriate field validation.

#### Scenario: Project creation validation
- **WHEN** a client sends POST /orgs/:orgId/projects with empty name
- **THEN** the system returns HTTP 400 with validation error for required name field

#### Scenario: Repository creation validation
- **WHEN** a client sends POST /projects/:projectId/repos with invalid gitRemote URL
- **THEN** the system returns HTTP 400 with URL format validation error

#### Scenario: Project name update validation
- **WHEN** a client sends PATCH /orgs/:orgId/projects/:projectId with name exceeding length limit
- **THEN** the system returns HTTP 400 with length validation error

### Requirement: Synthesis controller DTO validation
The system SHALL create DTOs for synthesis operations with proper validation for callback payloads.

#### Scenario: Synthesis callback validation
- **WHEN** a client sends POST /internal/synthesis/status with missing required fields
- **THEN** the system returns HTTP 400 with validation errors for missing projectId or status

#### Scenario: Synthesis file path validation
- **WHEN** a client requests GET /orgs/:orgSlug/projects/:projectSlug/synthesis/file without path parameter
- **THEN** the system returns HTTP 400 with validation error for missing path query parameter

### Requirement: Parameter validation for path and query parameters
The system SHALL validate UUID format for ID parameters and required query parameters across all controllers.

#### Scenario: Invalid UUID parameter
- **WHEN** a client sends request with non-UUID format for orgId, projectId, or repoId parameters
- **THEN** the system returns HTTP 400 with parameter format validation error

#### Scenario: Missing required query parameters
- **WHEN** a client sends request missing required query parameters
- **THEN** the system returns HTTP 400 with validation error for missing query parameter

### Requirement: Email format validation standard
The system SHALL use standard email format validation that accepts common email patterns without complex rules.

#### Scenario: Valid email formats
- **WHEN** a client provides email in format "user@domain.com", "user+tag@domain.co.uk", or "user.name@subdomain.domain.org"
- **THEN** the system accepts the email as valid

#### Scenario: Invalid email formats
- **WHEN** a client provides email without @ symbol, without domain, or with invalid characters
- **THEN** the system returns HTTP 400 with email format validation error