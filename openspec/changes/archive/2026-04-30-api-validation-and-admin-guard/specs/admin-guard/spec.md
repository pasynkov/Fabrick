## ADDED Requirements

### Requirement: IsAdminGuard implementation
The system SHALL implement an IsAdminGuard that verifies the authenticated user has admin role in the relevant organization from the OrgMember table.

#### Scenario: Admin role verification
- **WHEN** IsAdminGuard is activated for an endpoint
- **THEN** the system queries OrgMember table to verify user has role='admin' for the relevant organization

#### Scenario: Non-admin user access denial
- **WHEN** a user with role='member' attempts to access an admin-protected endpoint
- **THEN** the system returns HTTP 403 Forbidden with appropriate error message

#### Scenario: Non-org-member access denial
- **WHEN** a user not in the organization attempts to access an admin-protected endpoint
- **THEN** the system returns HTTP 403 Forbidden with appropriate error message

### Requirement: Organization name update protection
The system SHALL apply IsAdminGuard to PATCH /orgs/:orgId endpoint to restrict organization name changes to admin users only.

#### Scenario: Admin updates organization name
- **WHEN** an admin user sends PATCH /orgs/:orgId with valid name
- **THEN** the system successfully updates the organization name

#### Scenario: Member attempts to update organization name
- **WHEN** a member user sends PATCH /orgs/:orgId with valid name
- **THEN** the system returns HTTP 403 Forbidden

#### Scenario: Unauthorized user attempts organization name update
- **WHEN** a user not in the organization sends PATCH /orgs/:orgId
- **THEN** the system returns HTTP 403 Forbidden

### Requirement: Member addition protection
The system SHALL apply IsAdminGuard to POST /orgs/:orgId/members endpoint to restrict member addition to admin users only.

#### Scenario: Admin adds new member
- **WHEN** an admin user sends POST /orgs/:orgId/members with valid email and password
- **THEN** the system successfully adds the new member to the organization

#### Scenario: Member attempts to add new member
- **WHEN** a member user sends POST /orgs/:orgId/members with valid data
- **THEN** the system returns HTTP 403 Forbidden

#### Scenario: Non-member attempts to add member
- **WHEN** a user not in the organization sends POST /orgs/:orgId/members
- **THEN** the system returns HTTP 403 Forbidden

### Requirement: Project name update protection
The system SHALL apply IsAdminGuard to PATCH /orgs/:orgId/projects/:projectId endpoint to restrict project name changes to admin users only.

#### Scenario: Admin updates project name
- **WHEN** an admin user sends PATCH /orgs/:orgId/projects/:projectId with valid name
- **THEN** the system successfully updates the project name

#### Scenario: Member attempts to update project name
- **WHEN** a member user sends PATCH /orgs/:orgId/projects/:projectId with valid name
- **THEN** the system returns HTTP 403 Forbidden

#### Scenario: Cross-organization access denied
- **WHEN** an admin from organization A attempts to update a project in organization B
- **THEN** the system returns HTTP 403 Forbidden

### Requirement: Organization context extraction
The system SHALL extract organization context from request parameters to determine which organization's admin status to verify.

#### Scenario: Direct organization ID parameter
- **WHEN** the endpoint has :orgId parameter
- **THEN** IsAdminGuard uses that organization ID for admin role verification

#### Scenario: Nested organization context
- **WHEN** the endpoint has :projectId parameter but no :orgId
- **THEN** IsAdminGuard looks up the organization through the project relationship

#### Scenario: Invalid organization context
- **WHEN** the organization cannot be determined from request parameters
- **THEN** the system returns HTTP 400 Bad Request

### Requirement: Guard error handling
The system SHALL provide clear error messages when admin authorization fails with appropriate HTTP status codes.

#### Scenario: Insufficient permissions error
- **WHEN** a user lacks admin role for the operation
- **THEN** the system returns HTTP 403 with message indicating admin role required

#### Scenario: Organization membership error
- **WHEN** a user is not a member of the organization
- **THEN** the system returns HTTP 403 with message indicating organization membership required

#### Scenario: Database connection error during authorization
- **WHEN** the database is unavailable during admin role check
- **THEN** the system returns HTTP 500 Internal Server Error