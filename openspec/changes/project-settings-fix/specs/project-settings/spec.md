## ADDED Requirements

### Requirement: Project settings page access control
The system SHALL provide a project settings page accessible only to organization administrators at `/orgs/:orgSlug/projects/:projectSlug/settings`.

#### Scenario: Organization admin accesses project settings
- **WHEN** an organization admin navigates to the project settings page
- **THEN** page loads with current project settings form

#### Scenario: Non-admin user redirected from settings page
- **WHEN** a non-admin user attempts to access project settings
- **THEN** system redirects to project detail page with permission error

#### Scenario: Unauthenticated user blocked from settings
- **WHEN** an unauthenticated user attempts to access project settings
- **THEN** system redirects to login page

### Requirement: Project settings form functionality
The system SHALL provide a form for updating project name, API key, and auto-synthesis settings with proper validation and user feedback.

#### Scenario: Settings form loads with current values
- **WHEN** admin accesses project settings page
- **THEN** form is pre-populated with current project name and auto-synthesis toggle state

#### Scenario: API key field shows status without revealing key
- **WHEN** project has an API key configured
- **THEN** form shows key status indicator and hash without displaying actual key

#### Scenario: Successful settings update updates form state
- **WHEN** admin successfully submits settings changes
- **THEN** form updates to reflect new values and redirects to project detail page

### Requirement: Enhanced user experience during updates
The system SHALL provide clear feedback during settings operations with appropriate loading states and error handling.

#### Scenario: Loading state shown during save operation
- **WHEN** admin submits settings form
- **THEN** submit button shows "Saving..." state and is disabled until completion

#### Scenario: Form validation prevents invalid submissions
- **WHEN** form has validation errors
- **THEN** submit button remains disabled and errors are highlighted

#### Scenario: Navigation preserved after successful update
- **WHEN** settings are successfully updated
- **THEN** user is redirected to updated project detail page with success confirmation