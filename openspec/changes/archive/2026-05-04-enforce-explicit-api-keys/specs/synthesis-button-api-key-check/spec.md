## ADDED Requirements

### Requirement: Disable synthesis button when no API key is configured
The system SHALL disable the "Run Synthesis" button on the project detail page when no effective Anthropic API key exists (neither at the project level nor at the organization level).

#### Scenario: Button enabled with effective API key
- **WHEN** a project has an API key configured at the project level
- **THEN** the "Run Synthesis" button is enabled (not disabled)

#### Scenario: Button enabled with org-level API key
- **WHEN** a project has no API key configured at the project level but its organization has an API key configured
- **THEN** the "Run Synthesis" button is enabled (not disabled)

#### Scenario: Button disabled without effective API key
- **WHEN** a project has no API key configured at the project level AND its organization has no API key configured
- **THEN** the "Run Synthesis" button is disabled with a hint message: "Add API key to enable synthesis"

#### Scenario: Hint message links to settings
- **WHEN** the "Run Synthesis" button is disabled due to missing API key
- **THEN** the hint message or button contains a clickable link to `/orgs/:orgSlug/projects/:projectSlug/settings`
