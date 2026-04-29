## ADDED Requirements

### Requirement: Org admins can update organization name
Organization admins SHALL be able to update the name of their organization.

#### Scenario: Admin updates org name
- **GIVEN** the user is an org admin
- **WHEN** they send `PATCH /orgs/:orgId` with a valid name
- **THEN** the org name SHALL be updated and the change SHALL be logged

#### Scenario: Non-admin cannot update org name
- **GIVEN** the user is not an org admin
- **WHEN** they send `PATCH /orgs/:orgId`
- **THEN** the response SHALL be 403 Forbidden

#### Scenario: Slug is not changed on rename
- **GIVEN** an org with an existing slug
- **WHEN** the name is changed
- **THEN** the slug SHALL remain unchanged

#### Scenario: Name must not exceed 128 characters
- **WHEN** a name longer than 128 characters is submitted
- **THEN** the response SHALL be 400 Bad Request with a validation error

#### Scenario: Name must not be empty
- **WHEN** an empty name is submitted
- **THEN** the response SHALL be 400 Bad Request with a validation error
