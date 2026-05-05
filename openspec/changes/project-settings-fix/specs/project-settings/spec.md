## MODIFIED Requirements

### Requirement: Project settings page access control
The system SHALL provide a project settings page accessible only to organization administrators at `/orgs/:orgSlug/projects/:projectSlug/settings`.

#### Scenario: Organization admin accesses project settings
- **WHEN** an organization admin navigates to the project settings page
- **THEN** page loads with current project settings form, including the correct auto-synthesis toggle state

#### Scenario: Non-admin user redirected from settings page
- **WHEN** a non-admin user attempts to access project settings
- **THEN** system redirects to project detail page

#### Scenario: Unauthenticated user blocked from settings
- **WHEN** an unauthenticated user attempts to access project settings
- **THEN** system redirects to login page

### Requirement: Auto-synthesis toggle persistence
The system SHALL correctly load and persist the auto-synthesis toggle state in the project settings form.

#### Scenario: Toggle state is loaded from the correct endpoint
- **WHEN** admin accesses project settings page
- **THEN** form is pre-populated with the current `autoSynthesisEnabled` value from the project settings endpoint

#### Scenario: Toggle state persists after save
- **WHEN** admin enables the auto-synthesis toggle and saves
- **THEN** returning to the settings page shows the toggle in the enabled state

### Requirement: "Edit Settings" button on project main page
The system SHALL provide an "Edit Settings" button in the project main page header for admin users.

#### Scenario: Admin sees "Edit Settings" button in project header
- **WHEN** an organization admin views the project main page
- **THEN** an "Edit Settings" button is visible in the header area

#### Scenario: Non-admin does not see "Edit Settings" button
- **WHEN** a non-admin user views the project main page
- **THEN** no "Edit Settings" button is shown

#### Scenario: "Edit Settings" button navigates to project settings
- **WHEN** admin clicks "Edit Settings" button
- **THEN** user is navigated to `/orgs/:orgSlug/projects/:projectSlug/settings`
