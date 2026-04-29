## ADDED Requirements

### Requirement: Org admins can update project name
Organization admins SHALL be able to update the name of a project within their org.

#### Scenario: Admin updates project name
- **GIVEN** the user is an org admin
- **WHEN** they send `PATCH /orgs/:orgId/projects/:projectId` with a valid name
- **THEN** the project name SHALL be updated and the change SHALL be logged

#### Scenario: Non-admin cannot update project name
- **GIVEN** the user is not an org admin
- **WHEN** they send `PATCH /orgs/:orgId/projects/:projectId`
- **THEN** the response SHALL be 403 Forbidden

#### Scenario: Project slug is not changed on rename
- **GIVEN** a project with an existing slug
- **WHEN** the name is changed
- **THEN** the slug SHALL remain unchanged

#### Scenario: Project name must not exceed 128 characters
- **WHEN** a name longer than 128 characters is submitted
- **THEN** the response SHALL be 400 Bad Request with a validation error

#### Scenario: Project name must not be empty
- **WHEN** an empty name is submitted
- **THEN** the response SHALL be 400 Bad Request with a validation error
