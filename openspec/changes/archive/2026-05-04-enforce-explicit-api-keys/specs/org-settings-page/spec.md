## ADDED Requirements

### Requirement: Organization settings page accessible to admins
The system SHALL expose a settings page at `/orgs/:orgSlug/settings` that displays the organization name and Anthropic API key fields. Access SHALL be restricted to organization admins only.

#### Scenario: Admin accesses org settings
- **WHEN** an organization admin navigates to `/orgs/:orgSlug/settings`
- **THEN** the page renders with fields for organization name and API key, with current values pre-populated

#### Scenario: Non-admin attempt to access org settings
- **WHEN** a non-admin org member navigates to `/orgs/:orgSlug/settings`
- **THEN** the system redirects to the organization detail page with a permission error

#### Scenario: User not in org attempts access
- **WHEN** a user not in the organization navigates to `/orgs/:orgSlug/settings`
- **THEN** the system returns HTTP 403 Forbidden

### Requirement: Update organization name and API key via settings form
The system SHALL expose a form on the organization settings page that allows admins to update the organization name and Anthropic API key together.

#### Scenario: Successful settings update
- **WHEN** an org admin submits the settings form with `{ name: "New Name", anthropicApiKey: "sk-ant-..." }`
- **THEN** the system updates both fields, validates the API key format, and returns HTTP 200 with updated organization data

#### Scenario: Invalid API key format
- **WHEN** an org admin submits the form with an API key that does not start with `sk-ant-`
- **THEN** the system returns HTTP 400 with error message indicating invalid API key format

#### Scenario: API key left empty
- **WHEN** an org admin submits the form with an empty API key field
- **THEN** the system updates the organization name and clears the API key (allows org-level key to be cleared if project overrides it)
