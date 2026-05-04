## ADDED Requirements

### Requirement: Comprehensive unit test coverage for API key services
The system SHALL provide unit tests covering all API key service methods including encryption, validation, resolution, and audit logging with minimum 95% code coverage.

#### Scenario: Encryption service unit tests
- **WHEN** running the API key encryption service test suite
- **THEN** all encrypt/decrypt operations are tested with valid keys, invalid keys, and edge cases

#### Scenario: Validation service unit tests
- **WHEN** running the API key validation service test suite  
- **THEN** all format validation scenarios are tested including valid Anthropic keys, invalid prefixes, and malformed keys

#### Scenario: Resolution service unit tests
- **WHEN** running the API key resolution service test suite
- **THEN** all hierarchical resolution paths are tested including project-only, org-only, and missing key scenarios

### Requirement: Integration tests for API key endpoints
The system SHALL provide integration tests for all API key management endpoints covering authentication, authorization, input validation, and database operations.

#### Scenario: Organization API key endpoint integration tests
- **WHEN** running organization API key endpoint tests
- **THEN** all PATCH /orgs/:orgId and GET /orgs/:orgId/api-key/* endpoints are tested with proper auth and validation

#### Scenario: Project API key endpoint integration tests
- **WHEN** running project API key endpoint tests
- **THEN** all PATCH /projects/:projectId and GET /projects/:projectId/api-key/* endpoints are tested with proper auth and validation

### Requirement: End-to-end synthesis workflow testing
The system SHALL provide end-to-end tests validating complete synthesis workflows using different API key sources (project, organization) with proper error handling.

#### Scenario: Synthesis with project API key
- **WHEN** triggering synthesis for a project with a configured API key
- **THEN** the synthesis completes successfully using the project's API key

#### Scenario: Synthesis with organization API key fallback
- **WHEN** triggering synthesis for a project without an API key in an org with an API key
- **THEN** the synthesis completes successfully using the organization's API key

#### Scenario: Synthesis with no API key configured
- **WHEN** triggering synthesis for a project without an API key in an org without an API key
- **THEN** the synthesis fails with a clear error message prompting API key configuration