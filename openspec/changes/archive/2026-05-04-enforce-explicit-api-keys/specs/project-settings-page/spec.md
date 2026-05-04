## ADDED Requirements

### Requirement: Project settings page accessible to admins
The system SHALL expose a settings page at `/orgs/:orgSlug/projects/:projectSlug/settings` that displays the project name and Anthropic API key fields. Access SHALL be restricted to organization admins only (the org that owns the project).

#### Scenario: Admin accesses project settings
- **WHEN** an organization admin navigates to `/orgs/:orgSlug/projects/:projectSlug/settings`
- **THEN** the page renders with fields for project name and API key, with current values pre-populated

#### Scenario: Non-admin org member attempts access
- **WHEN** a non-admin org member navigates to `/orgs/:orgSlug/projects/:projectSlug/settings`
- **THEN** the system redirects to the project detail page with a permission error

#### Scenario: User not in org attempts access
- **WHEN** a user not in the organization navigates to `/orgs/:orgSlug/projects/:projectSlug/settings`
- **THEN** the system returns HTTP 403 Forbidden

### Requirement: Update project name and API key via settings form
The system SHALL expose a form on the project settings page that allows org admins to update the project name and Anthropic API key together.

#### Scenario: Successful settings update
- **WHEN** an org admin submits the project settings form with `{ name: "New Project Name", anthropicApiKey: "sk-ant-..." }`
- **THEN** the system updates both fields, validates the API key format, and returns HTTP 200 with updated project data

#### Scenario: Invalid API key format
- **WHEN** an org admin submits the form with an API key that does not start with `sk-ant-`
- **THEN** the system returns HTTP 400 with error message indicating invalid API key format

#### Scenario: API key left empty
- **WHEN** an org admin submits the form with an empty API key field
- **THEN** the system updates the project name and clears the project-level API key (allows org-level key to be used)
